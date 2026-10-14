import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { EmailVerificationToken } from '../src/models/EmailVerificationToken.js';
import crypto from 'crypto';

describe('Email Workflows & Verification End-to-End Tests', () => {
  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: { $in: ['tester@example.com', 'token@example.com'] } });
    await EmailVerificationToken.deleteMany({});
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('1. Registering an account generates verification token and OTP', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        displayName: 'Email Tester',
        username: 'email_tester',
        email: 'tester@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.success).toBe(true);

    const user = await User.findOne({ email: 'tester@example.com' });
    expect(user).toBeDefined();
    expect(user?.isEmailVerified).toBe(false);

    // Verify token record in DB
    const verificationRecord = await EmailVerificationToken.findOne({ userId: user?._id });
    expect(verificationRecord).toBeDefined();
    expect(verificationRecord?.otpCode).toMatch(/^[0-9]{6}$/);
    expect(verificationRecord?.used).toBe(false);
  });

  it('2. Successfully verifies email using 6-digit OTP code', async () => {
    const user = await User.findOne({ email: 'tester@example.com' });
    const record = await EmailVerificationToken.findOne({ userId: user?._id });
    expect(record).toBeDefined();

    const verifyRes = await request(app)
      .post('/api/auth/verify-email')
      .send({
        email: 'tester@example.com',
        code: record?.otpCode,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.message).toContain('successfully verified');

    const updatedUser = await User.findById(user?._id);
    expect(updatedUser?.isEmailVerified).toBe(true);

    const updatedRecord = await EmailVerificationToken.findById(record?._id);
    expect(updatedRecord?.used).toBe(true);
  });

  it('3. Resends verification email with new token & OTP', async () => {
    // Register another user
    await request(app)
      .post('/api/auth/register')
      .send({
        displayName: 'Token Tester',
        username: 'token_tester',
        email: 'token@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });

    const resendRes = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'token@example.com' });

    expect(resendRes.status).toBe(200);
    expect(resendRes.body.success).toBe(true);
    expect(resendRes.body.message).toContain('dispatched');
  });

  it('4. Successfully verifies email using raw token link', async () => {
    const user = await User.findOne({ email: 'token@example.com' });
    const record = await EmailVerificationToken.findOne({ userId: user?._id, used: false });
    expect(record).toBeDefined();

    // Verify with invalid token first
    const badRes = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: 'invalid_raw_token_value' });
    expect(badRes.status).toBe(400);

    // Simulate verification with matched SHA-256 token
    const testRawToken = 'test-token-' + crypto.randomBytes(16).toString('hex');
    const testHash = crypto.createHash('sha256').update(testRawToken).digest('hex');
    await EmailVerificationToken.create({
      userId: user?._id,
      tokenHash: testHash,
      otpCode: '123456',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      used: false,
    });

    const goodRes = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: testRawToken });

    expect(goodRes.status).toBe(200);
    expect(goodRes.body.success).toBe(true);

    const verifiedUser = await User.findById(user?._id);
    expect(verifiedUser?.isEmailVerified).toBe(true);
  });
});
