import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { MatchResult } from '../src/models/MatchResult.js';
import { Friendship } from '../src/models/Friendship.js';
import { Notification } from '../src/models/Notification.js';
import { UserAchievement } from '../src/models/UserAchievement.js';
import { Report } from '../src/models/Report.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { MatchHistoryService } from '../src/services/MatchHistoryService.js';
import { signAccessToken } from '../src/utils/jwt.js';

describe('Phase 5 — SaaS Social, Analytics, Moderation & Security Tests', () => {
  let playerAId: string;
  let playerBId: string;
  let adminId: string;

  let playerAToken: string;
  let playerBToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({});
    await MatchResult.deleteMany({});
    await Friendship.deleteMany({});
    await Notification.deleteMany({});
    await UserAchievement.deleteMany({});
    await Report.deleteMany({});
    await AuditLog.deleteMany({});

    // Create player A
    const userA = await User.create({
      username: 'playera',
      normalizedUsername: 'playera',
      displayName: 'Player Alpha',
      email: 'playera@example.com',
      normalizedEmail: 'playera@example.com',
      passwordHash: 'hash123',
      role: 'user',
      isOnboarded: true,
      profileVisibility: 'public',
      stats: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        totalScore: 0,
        highestScore: 0,
        correctGuesses: 0,
        drawingTurns: 0,
        currentStreak: 0,
        bestStreak: 0,
      },
    });
    playerAId = userA._id.toString();
    playerAToken = signAccessToken({
      userId: playerAId,
      username: 'playera',
      email: 'playera@example.com',
    });

    // Create player B
    const userB = await User.create({
      username: 'playerb',
      normalizedUsername: 'playerb',
      displayName: 'Player Bravo',
      email: 'playerb@example.com',
      normalizedEmail: 'playerb@example.com',
      passwordHash: 'hash123',
      role: 'user',
      isOnboarded: true,
      profileVisibility: 'friends_only',
      stats: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        totalScore: 0,
        highestScore: 0,
        correctGuesses: 0,
        drawingTurns: 0,
        currentStreak: 0,
        bestStreak: 0,
      },
    });
    playerBId = userB._id.toString();
    playerBToken = signAccessToken({
      userId: playerBId,
      username: 'playerb',
      email: 'playerb@example.com',
    });

    // Create Admin user
    const adminUser = await User.create({
      username: 'adminuser',
      normalizedUsername: 'adminuser',
      displayName: 'Admin User',
      email: 'admin@example.com',
      normalizedEmail: 'admin@example.com',
      passwordHash: 'hash123',
      role: 'admin',
      isOnboarded: true,
      profileVisibility: 'public',
    });
    adminId = adminUser._id.toString();
    adminToken = signAccessToken({
      userId: adminId,
      username: 'adminuser',
      email: 'admin@example.com',
    });
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('1. Health & Readiness Observability', () => {
    it('returns healthy status with uptime and memory', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.memory).toBeDefined();
    });

    it('returns database readiness', async () => {
      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.database).toBe('connected');
    });
  });

  describe('2. Match History & Exactly-Once Finalization', () => {
    it('persists match results and updates participant statistics', async () => {
      const gameId = 'game-phase5-001';
      const match = await MatchHistoryService.finalizeMatch({
        gameId,
        roomCode: 'RM1234',
        rounds: 3,
        category: 'general',
        players: [
          {
            userId: playerAId,
            username: 'playera',
            displayName: 'Player Alpha',
            avatar: 'avatar-1',
            score: 750,
            rank: 1,
            correctGuesses: 3,
            drawingTurns: 2,
          },
          {
            userId: playerBId,
            username: 'playerb',
            displayName: 'Player Bravo',
            avatar: 'avatar-2',
            score: 400,
            rank: 2,
            correctGuesses: 2,
            drawingTurns: 1,
          },
        ],
        winner: {
          userId: playerAId,
          displayName: 'Player Alpha',
          score: 750,
        },
        startedAt: new Date(Date.now() - 120000),
        completedAt: new Date(),
      });

      expect(match).toBeDefined();
      expect(match.gameId).toBe(gameId);

      // Verify User A stats updated
      const updatedUserA = await User.findById(playerAId);
      expect(updatedUserA?.stats.gamesPlayed).toBe(1);
      expect(updatedUserA?.stats.wins).toBe(1);
      expect(updatedUserA?.stats.losses).toBe(0);
      expect(updatedUserA?.stats.totalScore).toBe(750);
      expect(updatedUserA?.stats.currentStreak).toBe(1);
      expect(updatedUserA?.stats.winRate).toBe(100);

      // Verify User B stats updated
      const updatedUserB = await User.findById(playerBId);
      expect(updatedUserB?.stats.gamesPlayed).toBe(1);
      expect(updatedUserB?.stats.wins).toBe(0);
      expect(updatedUserB?.stats.losses).toBe(1);
      expect(updatedUserB?.stats.currentStreak).toBe(0);
      expect(updatedUserB?.stats.winRate).toBe(0);
    });

    it('enforces idempotency on duplicate finalization calls', async () => {
      const gameId = 'game-phase5-001';
      // Calling finalization again for the same gameId
      const secondCall = await MatchHistoryService.finalizeMatch({
        gameId,
        roomCode: 'RM1234',
        rounds: 3,
        category: 'general',
        players: [],
        winner: { userId: playerAId, displayName: 'Player Alpha', score: 750 },
        startedAt: new Date(),
        completedAt: new Date(),
      });

      expect(secondCall.gameId).toBe(gameId);

      // Player A gamesPlayed must still be 1, not duplicated to 2
      const userA = await User.findById(playerAId);
      expect(userA?.stats.gamesPlayed).toBe(1);
    });

    it('retrieves user match history via REST endpoint', async () => {
      const res = await request(app)
        .get('/api/matches/my')
        .set('Authorization', `Bearer ${playerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.matches.length).toBe(1);
      expect(res.body.matches[0].roomCode).toBe('RM1234');
    });

    it('retrieves match details by string gameId and handles non-existent identifiers safely', async () => {
      const targetGameId = 'game-phase5-001';
      const res1 = await request(app)
        .get(`/api/matches/${targetGameId}`)
        .set('Authorization', `Bearer ${playerAToken}`);
      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.match.gameId).toBe(targetGameId);

      const res2 = await request(app)
        .get('/api/matches/non_existent_game_string')
        .set('Authorization', `Bearer ${playerAToken}`);
      expect(res2.status).toBe(404);
      expect(res2.body.success).toBe(false);
    });

    it('allows rebuilding user statistics from canonical history', async () => {
      const res = await request(app)
        .post('/api/users/stats/rebuild')
        .set('Authorization', `Bearer ${playerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.gamesPlayed).toBe(1);
      expect(res.body.stats.wins).toBe(1);
    });
  });

  describe('3. Profile Visibility & Privacy Enforcement', () => {
    it('allows public access to public profiles', async () => {
      const res = await request(app).get('/api/users/playera');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isPrivate).toBe(false);
      expect(res.body.profile.stats).toBeDefined();
    });

    it('enforces friends-only privacy when viewers are not friends', async () => {
      const res = await request(app)
        .get('/api/users/playerb')
        .set('Authorization', `Bearer ${playerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isPrivate).toBe(true);
      expect(res.body.isFriendsOnly).toBe(true);
      expect(res.body.profile.bio).toBeUndefined(); // Private information hidden!
    });
  });

  describe('4. Social Hub — Friend Requests & Lifecycle', () => {
    let activeRequestId = '';

    it('discovers other players via search excluding self', async () => {
      const res = await request(app)
        .get('/api/friends/search?q=Bravo')
        .set('Authorization', `Bearer ${playerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.users.length).toBe(1);
      expect(res.body.users[0].username).toBe('playerb');
    });

    it('prevents sending a friend request to oneself', async () => {
      const res = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${playerAToken}`)
        .send({ recipientId: playerAId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('successfully sends a friend request from Player A to Player B', async () => {
      const res = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${playerAToken}`)
        .send({ recipientId: playerBId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.friendship).toBeDefined();
      activeRequestId = res.body.friendship._id;
    });

    it('lists incoming requests for Player B and outgoing requests for Player A', async () => {
      const resB = await request(app)
        .get('/api/friends/requests')
        .set('Authorization', `Bearer ${playerBToken}`);

      expect(resB.status).toBe(200);
      expect(resB.body.incoming.length).toBe(1);
      expect(resB.body.incoming[0].sender.username).toBe('playera');

      const resA = await request(app)
        .get('/api/friends/requests')
        .set('Authorization', `Bearer ${playerAToken}`);

      expect(resA.status).toBe(200);
      expect(resA.body.outgoing.length).toBe(1);
    });

    it('allows Player B to accept the friend request', async () => {
      const res = await request(app)
        .post('/api/friends/respond')
        .set('Authorization', `Bearer ${playerBToken}`)
        .send({ requestId: activeRequestId, action: 'accept' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('shows Player B in Player A friends list', async () => {
      const res = await request(app)
        .get('/api/friends')
        .set('Authorization', `Bearer ${playerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.friends.length).toBe(1);
      expect(res.body.friends[0].id).toBe(playerBId);
    });

    it('now allows Player A to view Player B profile since they are friends', async () => {
      const res = await request(app)
        .get('/api/users/playerb')
        .set('Authorization', `Bearer ${playerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isPrivate).toBe(false);
      expect(res.body.profile.stats).toBeDefined();
    });

    it('sends room invitation to friend', async () => {
      const res = await request(app)
        .post('/api/friends/invite')
        .set('Authorization', `Bearer ${playerAToken}`)
        .send({ friendId: playerBId, roomCode: 'DRAW42' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('5. Notifications & Preferences', () => {
    let unreadNotificationId = '';

    it('retrieves notifications for Player B', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${playerBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.notifications.length).toBeGreaterThan(0);
      expect(res.body.unreadCount).toBeGreaterThan(0);
      unreadNotificationId = res.body.notifications[0]._id;
    });

    it('marks a specific notification as read', async () => {
      const res = await request(app)
        .patch(`/api/notifications/${unreadNotificationId}/read`)
        .set('Authorization', `Bearer ${playerBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects invalid notification identifier format with HTTP 400', async () => {
      const res = await request(app)
        .patch('/api/notifications/invalid-id-format/read')
        .set('Authorization', `Bearer ${playerBToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('marks all notifications as read', async () => {
      const res = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${playerBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${playerBToken}`);

      expect(check.body.unreadCount).toBe(0);
    });
  });

  describe('6. Achievements Progression', () => {
    it('retrieves achievements list with unlocked progress', async () => {
      const res = await request(app)
        .get('/api/achievements/my')
        .set('Authorization', `Bearer ${playerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.achievements.length).toBeGreaterThanOrEqual(5);

      // Player A has 1 win and 1 game played, so 'first_game' and 'first_win' should be unlocked
      const firstGame = res.body.achievements.find((a: any) => a.id === 'first_game');
      const firstWin = res.body.achievements.find((a: any) => a.id === 'first_win');
      expect(firstGame?.unlocked).toBe(true);
      expect(firstWin?.unlocked).toBe(true);
    });
  });

  describe('7. Global Leaderboards', () => {
    it('ranks players by total score', async () => {
      const res = await request(app)
        .get('/api/leaderboard?category=score')
        .set('Authorization', `Bearer ${playerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.entries.length).toBeGreaterThanOrEqual(2);
      expect(res.body.entries[0].userId).toBe(playerAId);
      expect(res.body.entries[0].value).toBe(750);
      expect(res.body.currentUserRank?.rank).toBe(1);
    });

    it('ranks players by wins', async () => {
      const res = await request(app)
        .get('/api/leaderboard?category=wins')
        .set('Authorization', `Bearer ${playerBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.entries[0].userId).toBe(playerAId);
      expect(res.body.currentUserRank?.userId).toBe(playerBId);
      expect(res.body.currentUserRank?.rank).toBe(2);
    });
  });

  describe('8. Moderation, Reports & Administrative Security', () => {
    let reportId = '';

    it('allows authenticated player to submit a report', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${playerAToken}`)
        .send({
          targetType: 'user',
          targetId: playerBId,
          category: 'harassment',
          explanation: 'Player used inappropriate language in drawing canvas.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.report).toBeDefined();
      reportId = res.body.report._id;
    });

    it('strictly forbids normal players from accessing admin reports queue', async () => {
      const res = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${playerAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows admin to view reports queue', async () => {
      const res = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reports.length).toBeGreaterThanOrEqual(1);
    });

    it('allows admin to update report status with resolution notes', async () => {
      const res = await request(app)
        .patch(`/api/admin/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'resolved',
          moderatorNotes: 'Reviewed incident and issued temporary warning.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.report.status).toBe('resolved');
    });

    it('allows admin to execute moderation actions and generates audit logs', async () => {
      const res = await request(app)
        .post('/api/admin/moderation/action')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'kick',
          targetUserId: playerBId,
          roomCode: 'RM1234',
          reason: 'Excessive spam',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify audit log created
      const auditRes = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.logs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('9. Account Lifecycle & Personal Data Export', () => {
    it('exports user personal data safely without sensitive credentials', async () => {
      const res = await request(app)
        .get('/api/users/export')
        .set('Authorization', `Bearer ${playerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe('playera');
      expect(res.body.user.passwordHash).toBeUndefined(); // Never export password hash!
      expect(res.body.matches).toBeDefined();
      expect(res.body.achievements).toBeDefined();
    });
  });
});
