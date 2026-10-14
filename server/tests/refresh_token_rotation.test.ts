import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Session } from '../src/models/Session.js';
import { hashPassword } from '../src/utils/password.js';
import { hashToken } from '../src/utils/token.js';
import { signRefreshToken } from '../src/utils/jwt.js';

describe('SE-08: Secure Refresh-Token Rotation & Replay Protection Tests', () => {
  let testUser: any;
  let suspendedUser: any;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: { $in: ['rotation@test.com', 'suspended@test.com'] } });
    await Session.deleteMany({});

    const pwd = await hashPassword('RotationTest123!');
    testUser = await User.create({
      displayName: 'Rotation Tester',
      username: 'rot_tester',
      normalizedUsername: 'rot_tester',
      email: 'rotation@test.com',
      normalizedEmail: 'rotation@test.com',
      passwordHash: pwd,
      status: 'active',
    });

    suspendedUser = await User.create({
      displayName: 'Suspended Tester',
      username: 'susp_tester',
      normalizedUsername: 'susp_tester',
      email: 'suspended@test.com',
      normalizedEmail: 'suspended@test.com',
      passwordHash: pwd,
      status: 'suspended',
    });
  });

  beforeEach(async () => {
    await Session.deleteMany({});
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('1. A valid refresh token successfully rotates and issues new access & refresh tokens', async () => {
    // Log in to create initial session
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'rotation@test.com', password: 'RotationTest123!' });

    expect(loginRes.status).toBe(200);
    const initialRefreshToken = loginRes.body.refreshToken;
    expect(initialRefreshToken).toBeDefined();

    // Perform refresh
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: initialRefreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.accessToken).toBeDefined();
    expect(refreshRes.body.refreshToken).toBeDefined();
    expect(refreshRes.body.refreshToken).not.toBe(initialRefreshToken); // Token rotated!

    // Verify Set-Cookie header contains rotated refresh_token
    const cookies = refreshRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const refreshCookie = cookies?.find((c: string) => c.startsWith('refresh_token='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
  });

  it('2. The newly issued refresh token works for subsequent refresh', async () => {
    // Log in
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'rotation@test.com', password: 'RotationTest123!' });

    const token1 = loginRes.body.refreshToken;

    // First rotation: token1 -> token2
    const res1 = await request(app).post('/api/auth/refresh').send({ refreshToken: token1 });
    expect(res1.status).toBe(200);
    const token2 = res1.body.refreshToken;

    // Second rotation: token2 -> token3
    const res2 = await request(app).post('/api/auth/refresh').send({ refreshToken: token2 });
    expect(res2.status).toBe(200);
    const token3 = res2.body.refreshToken;
    expect(token3).not.toBe(token2);
    expect(token3).not.toBe(token1);
  });

  it('3. Replay Protection: Reusing a rotated token outside the grace window triggers session revocation', async () => {
    // Log in
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'rotation@test.com', password: 'RotationTest123!' });

    const originalToken = loginRes.body.refreshToken;

    // Rotate: originalToken -> successorToken
    const rotateRes = await request(app).post('/api/auth/refresh').send({ refreshToken: originalToken });
    expect(rotateRes.status).toBe(200);
    const successorToken = rotateRes.body.refreshToken;

    // Simulate elapsed time beyond the 10-second grace window (e.g. 15 seconds ago)
    const session = await Session.findOne({ refreshTokenHash: hashToken(successorToken) });
    expect(session).toBeDefined();
    session!.rotatedAt = new Date(Date.now() - 15000);
    await session!.save();

    // Attacker or rogue client attempts to reuse originalToken after grace period
    const replayRes = await request(app).post('/api/auth/refresh').send({ refreshToken: originalToken });
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error).toContain('reuse detected');

    // Verify session was revoked immediately for security
    const revokedSession = await Session.findById(session!._id);
    expect(revokedSession?.revoked).toBe(true);

    // Verify that even the legitimate successorToken is now rejected because session was compromised
    const subsequentRes = await request(app).post('/api/auth/refresh').send({ refreshToken: successorToken });
    expect(subsequentRes.status).toBe(401);
    expect(subsequentRes.body.error).toContain('revoked');
  });

  it('4. Concurrency & Network Retry: Legitimate in-flight retry within grace window succeeds without revoking', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'rotation@test.com', password: 'RotationTest123!' });

    const originalToken = loginRes.body.refreshToken;

    // Rotate: originalToken -> newToken
    const rotateRes = await request(app).post('/api/auth/refresh').send({ refreshToken: originalToken });
    expect(rotateRes.status).toBe(200);

    // In-flight concurrent request / network timeout retry sends originalToken within 2 seconds
    const retryRes = await request(app).post('/api/auth/refresh').send({ refreshToken: originalToken });
    expect(retryRes.status).toBe(200);
    expect(retryRes.body.success).toBe(true);
    expect(retryRes.body.accessToken).toBeDefined();

    // Verify session is still valid (not revoked)
    const session = await Session.findOne({ previousRefreshTokenHash: hashToken(originalToken) });
    expect(session?.revoked).toBe(false);
  });

  it('5. Suspended or inactive account is rejected and revokes active session', async () => {
    // Generate valid JWT signed for suspended user
    const rawSuspendedToken = signRefreshToken({
      userId: suspendedUser._id.toString(),
      username: suspendedUser.username,
      email: suspendedUser.email,
    });
    const hash = hashToken(rawSuspendedToken);

    await Session.create({
      userId: suspendedUser._id,
      refreshTokenHash: hash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revoked: false,
    });

    const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken: rawSuspendedToken });
    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error).toContain('suspended');

    const session = await Session.findOne({ refreshTokenHash: hash });
    expect(session?.revoked).toBe(true);
  });

  it('6. Malformed or invalid token signature is rejected with 401', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'not.a.valid.jwt.token' });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid or expired');
  });

  it('7. Logout revokes the session and prevents any subsequent refresh', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'rotation@test.com', password: 'RotationTest123!' });

    const token = loginRes.body.refreshToken;

    // Logout
    const logoutRes = await request(app).post('/api/auth/logout').send({ refreshToken: token });
    expect(logoutRes.status).toBe(200);

    // Subsequent refresh attempt
    const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken: token });
    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error).toContain('revoked');
  });

  it('8. Concurrent requests using the same token do not create multiple valid successors (CAS atomicity)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'rotation@test.com', password: 'RotationTest123!' });

    const sharedToken = loginRes.body.refreshToken;

    // Fire 3 simultaneous refresh requests with the exact same initial refresh token
    const [resA, resB, resC] = await Promise.all([
      request(app).post('/api/auth/refresh').send({ refreshToken: sharedToken }),
      request(app).post('/api/auth/refresh').send({ refreshToken: sharedToken }),
      request(app).post('/api/auth/refresh').send({ refreshToken: sharedToken }),
    ]);

    // All should return 200 (either winning the CAS rotation or being served active credentials in grace window)
    expect([200, 401]).toContain(resA.status);
    expect([200, 401]).toContain(resB.status);
    expect([200, 401]).toContain(resC.status);

    // Verify there is still only ONE active unrevoked session for this user in MongoDB (no session forking!)
    const activeSessions = await Session.find({ userId: testUser._id, revoked: false });
    expect(activeSessions.length).toBe(1);
  });
});
