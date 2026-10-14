import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Feedback } from '../src/models/Feedback.js';
import { ProductAnalyticsEvent } from '../src/models/ProductAnalyticsEvent.js';
import { featureFlagService } from '../src/config/featureFlags.js';
import { operationalMetrics } from '../src/services/OperationalMetrics.js';
import { telemetryService } from '../src/services/TelemetryService.js';
import { incidentDiagnosticService } from '../src/services/IncidentDiagnosticService.js';
import { signAccessToken } from '../src/utils/jwt.js';

describe('Phase 8 — Controlled Beta Launch, Observability, Telemetry & Diagnostics', () => {
  let adminId: string;
  let adminToken: string;
  let playerId: string;
  let playerToken: string;

  beforeAll(async () => {
    await connectDB();
    await Feedback.deleteMany({});
    await ProductAnalyticsEvent.deleteMany({});

    // Create Admin
    const adminUser = await User.create({
      username: 'beta_admin',
      normalizedUsername: 'beta_admin',
      displayName: 'Beta Admin',
      email: 'admin_beta@drawmate.app',
      normalizedEmail: 'admin_beta@drawmate.app',
      passwordHash: 'hash123',
      role: 'admin',
      isOnboarded: true,
    });
    adminId = adminUser._id.toString();
    adminToken = signAccessToken({ userId: adminId, username: 'beta_admin', email: 'admin_beta@drawmate.app' });

    // Create Normal Player
    const playerUser = await User.create({
      username: 'beta_player',
      normalizedUsername: 'beta_player',
      displayName: 'Beta Player',
      email: 'player_beta@drawmate.app',
      normalizedEmail: 'player_beta@drawmate.app',
      passwordHash: 'hash123',
      role: 'user',
      isOnboarded: true,
    });
    playerId = playerUser._id.toString();
    playerToken = signAccessToken({ userId: playerId, username: 'beta_player', email: 'player_beta@drawmate.app' });
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Feature Flags & Controlled Rollout', () => {
    it('returns active beta feature flags via public endpoint', async () => {
      const res = await request(app).get('/api/features');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.flags).toBeDefined();
      expect(typeof res.body.flags.imposterModeEnabled).toBe('boolean');
      expect(typeof res.body.flags.betaFeedbackEnabled).toBe('boolean');
    });

    it('rejects non-admin from modifying feature flags', async () => {
      const res = await request(app)
        .patch('/api/admin/features')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ imposterModeEnabled: false });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows admin to dynamically update feature flags', async () => {
      const res = await request(app)
        .patch('/api/admin/features')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ imposterModeEnabled: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.flags.imposterModeEnabled).toBe(false);

      // Revert back
      featureFlagService.updateFlags({ imposterModeEnabled: true });
    });
  });

  describe('Structured Player Beta Feedback', () => {
    let createdFeedbackId: string;

    it('accepts valid feedback submission from authenticated or anonymous player', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          category: 'drawing_touch',
          description: 'Undo button was slightly delayed when rapid drawing on mobile.',
          roomCode: 'TEST1234',
          clientDiagnostics: {
            userAgent: 'Mozilla/5.0 Mobile',
            screenResolution: '390x844',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.feedbackId).toBeDefined();
      createdFeedbackId = res.body.feedbackId;

      const record = await Feedback.findById(createdFeedbackId);
      expect(record).not.toBeNull();
      expect(record?.category).toBe('drawing_touch');
      expect(record?.status).toBe('new');
    });

    it('validates minimum description length and category enum', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({
          category: 'invalid_category_name',
          description: 'hi',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('enforces server-side feature flag if beta feedback is disabled', async () => {
      featureFlagService.updateFlags({ betaFeedbackEnabled: false });

      const res = await request(app)
        .post('/api/feedback')
        .send({
          category: 'general_suggestion',
          description: 'Add more pastel palette options.',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/paused/i);

      // Re-enable
      featureFlagService.updateFlags({ betaFeedbackEnabled: true });
    });

    it('allows moderators and admins to list and update feedback status', async () => {
      const listRes = await request(app)
        .get('/api/admin/feedback')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.feedbacks.length).toBeGreaterThanOrEqual(1);

      const updateRes = await request(app)
        .patch(`/api/admin/feedback/${createdFeedbackId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'reviewed',
          adminNotes: 'Verified on iPhone 14 test runner.',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.feedback.status).toBe('reviewed');
      expect(updateRes.body.feedback.adminNotes).toBe('Verified on iPhone 14 test runner.');
    });
  });

  describe('Operational Metrics & Health Observability', () => {
    it('protects operational metrics with strict admin role requirement', async () => {
      const unauth = await request(app).get('/api/admin/metrics/operational');
      expect(unauth.status).toBe(401);

      const nonAdmin = await request(app)
        .get('/api/admin/metrics/operational')
        .set('Authorization', `Bearer ${playerToken}`);
      expect(nonAdmin.status).toBe(403);
    });

    it('produces accurate, non-zero operational metrics snapshot', async () => {
      // Simulate operations
      operationalMetrics.recordHttpRequest(200, 15.5);
      operationalMetrics.recordHttpRequest(404, 2.1);
      operationalMetrics.recordSocketConnect();
      operationalMetrics.recordRoomCreated(true);
      operationalMetrics.recordMatchStarted();
      operationalMetrics.recordMatchCompleted();
      operationalMetrics.recordGenAiRequest(true, false);
      operationalMetrics.recordSketchInference(120, true);

      const res = await request(app)
        .get('/api/admin/metrics/operational')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      expect(data.system.nodeVersion).toBeDefined();
      expect(data.system.dbConnectionState).toBe('connected');
      expect(data.application.totalRequests).toBeGreaterThanOrEqual(1);
      expect(data.application.apiLatency.avgMs).toBeGreaterThan(0);
      expect(data.multiplayer.activeSockets).toBeGreaterThanOrEqual(0);
      expect(data.multiplayer.matchCompletionRatePercent).toBe(100);
      expect(data.aiServices.genAiSuccessRatePercent).toBe(100);
    });
  });

  describe('Product Analytics & Privacy Protections', () => {
    it('strictly sanitizes and discards secret words, guessed text, and raw strokes', async () => {
      await telemetryService.trackEvent({
        eventName: 'test_leak_guard',
        userId: playerId,
        gameId: 'game_xyz',
        properties: {
          roundNumber: 2,
          playerCount: 4,
          secretWord: 'CONFIDENTIAL_SECRET',
          guess: 'secret_leak_attempt',
          chatMessage: 'Hey secret word is apple',
          strokes: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
          token: 'jwt_secret_token_leaked',
        },
      });

      const stored = await ProductAnalyticsEvent.findOne({ eventName: 'test_leak_guard' });
      expect(stored).not.toBeNull();
      expect(stored?.properties.roundNumber).toBe(2);
      expect(stored?.properties.playerCount).toBe(4);

      // Verify privacy stripping
      expect(stored?.properties.secretWord).toBeUndefined();
      expect(stored?.properties.guess).toBeUndefined();
      expect(stored?.properties.chatMessage).toBeUndefined();
      expect(stored?.properties.token).toBeUndefined();
      // Strokes array transformed to count only, no coordinates
      expect(stored?.properties.strokes).toBe(2);
    });

    it('aggregates product KPIs for admin dashboard', async () => {
      const res = await request(app)
        .get('/api/admin/metrics/analytics?days=7')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.periodDays).toBe(7);
      expect(res.body.data.totalEvents).toBeGreaterThanOrEqual(1);
      expect(res.body.data.featureAdoption).toBeDefined();
    });
  });

  describe('Incident Diagnostics & Error Grouping', () => {
    it('records and returns recent system incidents in bounded ring buffer', async () => {
      incidentDiagnosticService.recordIncident('database', 'Simulated transient connection timeout', {
        cluster: 'atlas-replica-0',
        attempt: 1,
      });

      const res = await request(app)
        .get('/api/admin/incidents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.incidents.length).toBeGreaterThanOrEqual(1);
      expect(res.body.summary.byCategory.database).toBeGreaterThanOrEqual(1);

      const latest = res.body.incidents[0];
      expect(latest.category).toBe('database');
      expect(latest.message).toContain('Simulated transient connection timeout');
    });
  });
});
