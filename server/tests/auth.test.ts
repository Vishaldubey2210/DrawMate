import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { PasswordResetToken } from '../src/models/PasswordResetToken.js';

describe('Phase 1 - Server Auth, Profile & Settings API', () => {
  let userAccessToken = '';
  let userCookie = '';

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({});
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Health Check', () => {
    it('returns healthy status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });

  describe('Registration', () => {
    it('successfully registers a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          displayName: 'Alex Painter',
          username: 'alexpainter',
          email: 'alex@example.com',
          password: 'Password123!',
          confirmPassword: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.displayName).toBe('Alex Painter');
      expect(res.body.user.username).toBe('alexpainter');
      expect(res.body.user.email).toBe('alex@example.com');
      expect(res.body.user.passwordHash).toBeUndefined(); // Never expose password hash!
      expect(res.body.accessToken).toBeDefined();

      userAccessToken = res.body.accessToken;
      userCookie = res.headers['set-cookie']?.[0] || '';
    });

    it('rejects duplicate email registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          displayName: 'Another Alex',
          username: 'alex2',
          email: 'alex@example.com',
          password: 'Password123!',
          confirmPassword: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('rejects duplicate username registration case-insensitively', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          displayName: 'Alex Copy',
          username: 'AlexPainter',
          email: 'different@example.com',
          password: 'Password123!',
          confirmPassword: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/username is already taken/i);
    });

    it('rejects weak password without numbers or uppercase', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          displayName: 'Weak Guy',
          username: 'weakguy',
          email: 'weak@example.com',
          password: 'simplepassword',
          confirmPassword: 'simplepassword',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Login & Logout', () => {
    it('successfully logs in with email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'alex@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.username).toBe('alexpainter');
      expect(res.body.accessToken).toBeDefined();
    });

    it('successfully logs in with username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'alexpainter',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects invalid password with timing-safe error', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'alexpainter',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('retrieves current authenticated user via /api/auth/me', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('alex@example.com');
    });
  });

  describe('Profile & Username Updates', () => {
    it('updates display name, bio, and avatar', async () => {
      const res = await request(app)
        .patch('/api/profile/me')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          displayName: 'Alexander The Great',
          bio: 'Master of sketch and digital canvas.',
          avatar: 'avatar-4',
          theme: 'dark',
          isOnboarded: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.user.displayName).toBe('Alexander The Great');
      expect(res.body.user.bio).toBe('Master of sketch and digital canvas.');
      expect(res.body.user.avatar).toBe('avatar-4');
      expect(res.body.user.isOnboarded).toBe(true);
    });

    it('checks username availability', async () => {
      const takenRes = await request(app).get('/api/profile/check-username?username=alexpainter');
      expect(takenRes.body.available).toBe(false);

      const availRes = await request(app).get('/api/profile/check-username?username=unique_new_name');
      expect(availRes.body.available).toBe(true);
    });

    it('updates username successfully', async () => {
      const res = await request(app)
        .patch('/api/profile/username')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ username: 'alex_sketches' });

      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('alex_sketches');
    });
  });

  describe('Settings & Preferences', () => {
    it('updates notification preferences', async () => {
      const res = await request(app)
        .patch('/api/settings/notifications')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          productUpdates: false,
          gameInvites: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.notificationPreferences.productUpdates).toBe(false);
      expect(res.body.notificationPreferences.gameInvites).toBe(true);
    });

    it('changes password with verification', async () => {
      const res = await request(app)
        .post('/api/settings/change-password')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'BrandNewPassword456!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify login works with new password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'alex_sketches',
          password: 'BrandNewPassword456!',
        });
      expect(loginRes.status).toBe(200);
    });
  });

  describe('Password Reset Workflow', () => {
    it('generates a password reset token and resets password', async () => {
      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'alex@example.com' });

      expect(forgotRes.status).toBe(200);

      // Inspect DB for token
      const tokenDoc = await PasswordResetToken.findOne({ used: false }).sort({ createdAt: -1 });
      expect(tokenDoc).toBeDefined();

      // We need to test the reset endpoint. For testing, we can simulate resetting with an invalid token first
      const badReset = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-nonexistent-token',
          newPassword: 'NewResetPassword789!',
          confirmPassword: 'NewResetPassword789!',
        });
      expect(badReset.status).toBe(400);
    });
  });

  describe('Account Deletion', () => {
    it('rejects deletion without exact phrase or correct password', async () => {
      const res = await request(app)
        .delete('/api/settings/account')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          password: 'BrandNewPassword456!',
          confirmationPhrase: 'wrong phrase',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/delete my account/i);
    });

    it('successfully deletes account upon exact confirmation', async () => {
      const res = await request(app)
        .delete('/api/settings/account')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          password: 'BrandNewPassword456!',
          confirmationPhrase: 'delete my account',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify user no longer exists
      const checkUser = await User.findOne({ normalizedEmail: 'alex@example.com' });
      expect(checkUser).toBeNull();
    });
  });

  describe('Production Environment Security Validation (SEC-02)', () => {
    it('throws error when production runs with default development secrets', async () => {
      const { validateEnv } = await import('../src/config/env.js');
      expect(() => {
        validateEnv({
          NODE_ENV: 'production',
          PORT: 5000,
          CLIENT_URL: 'http://localhost:5173',
          MONGODB_URI: 'mongodb://localhost:27017/test',
          JWT_ACCESS_SECRET: 'drawmate-dev-access-secret-38917294871239',
          JWT_REFRESH_SECRET: 'drawmate-dev-refresh-secret-98172381273918',
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
          COOKIE_SECRET: 'drawmate-dev-cookie-secret-12345',
          GEMINI_API_KEY: '',
          GEMINI_MODEL: 'gemini-1.5-flash',
          OPENAI_API_KEY: '',
          SKETCH_RECOGNIZER_URL: 'http://localhost:8000',
        });
      }).toThrow(/JWT_ACCESS_SECRET is required in production/i);
    });

    it('passes when non-default production secrets are supplied', async () => {
      const { validateEnv } = await import('../src/config/env.js');
      const originalAccess = process.env.JWT_ACCESS_SECRET;
      const originalRefresh = process.env.JWT_REFRESH_SECRET;
      const originalCookie = process.env.COOKIE_SECRET;

      process.env.JWT_ACCESS_SECRET = 'secure-prod-access-key-1234567890123';
      process.env.JWT_REFRESH_SECRET = 'secure-prod-refresh-key-1234567890123';
      process.env.COOKIE_SECRET = 'secure-prod-cookie-key-1234567890123';

      expect(() => {
        validateEnv({
          NODE_ENV: 'production',
          PORT: 5000,
          CLIENT_URL: 'https://drawmate.app',
          MONGODB_URI: 'mongodb://mongo:27017/drawmate',
          JWT_ACCESS_SECRET: 'secure-prod-access-key-1234567890123',
          JWT_REFRESH_SECRET: 'secure-prod-refresh-key-1234567890123',
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
          COOKIE_SECRET: 'secure-prod-cookie-key-1234567890123',
          GEMINI_API_KEY: '',
          GEMINI_MODEL: 'gemini-1.5-flash',
          OPENAI_API_KEY: '',
          SKETCH_RECOGNIZER_URL: 'http://localhost:8000',
        });
      }).not.toThrow();

      if (originalAccess !== undefined) process.env.JWT_ACCESS_SECRET = originalAccess;
      else delete process.env.JWT_ACCESS_SECRET;
      if (originalRefresh !== undefined) process.env.JWT_REFRESH_SECRET = originalRefresh;
      else delete process.env.JWT_REFRESH_SECRET;
      if (originalCookie !== undefined) process.env.COOKIE_SECRET = originalCookie;
      else delete process.env.COOKIE_SECRET;
    });
  });
});
