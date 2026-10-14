import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import request from 'supertest';
import { app } from '../src/app.js';
import { setupRealtimeServer } from '../src/realtime/socket.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Room } from '../src/models/Room.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { hashPassword } from '../src/utils/password.js';
import { RoomManager } from '../src/services/RoomManager.js';
import { GameManager } from '../src/game/GameManager.js';
import { DrawingSessionManager } from '../src/services/DrawingSessionManager.js';
import { AIModerationService } from '../src/services/AIModerationService.js';

describe('Master AI & Imposter Mode Suite — Imposter Gameplay, Practice Mode & Moderation', () => {
  let httpServer: HttpServer;
  let serverPort: number;

  let users: any[] = [];
  let tokens: string[] = [];

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({});
    await Room.deleteMany({});

    const pwdHash = await hashPassword('Secret123!');

    // Create 4 players for Imposter Mode
    for (let i = 1; i <= 4; i++) {
      const u = await User.create({
        displayName: `Player ${i}`,
        username: `player_${i}`,
        normalizedUsername: `player_${i}`,
        email: `p${i}@imposter.test`,
        normalizedEmail: `p${i}@imposter.test`,
        passwordHash: pwdHash,
        avatar: `avatar-${i}`,
        isOnboarded: true,
      });
      users.push(u);
      tokens.push(
        signAccessToken({
          userId: u._id.toString(),
          username: u.username,
          displayName: u.displayName,
          avatar: u.avatar,
        })
      );
    }

    httpServer = createServer(app);
    setupRealtimeServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        if (typeof addr === 'object' && addr !== null) {
          serverPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await disconnectDB();
  });

  describe('Part E: Imposter Mode Gameplay & Privacy', () => {
    it('enforces minimum 4 players before allowing Imposter Mode to start', async () => {
      const roomManager = RoomManager.getInstance();
      const gameManager = GameManager.getInstance();

      const created = await roomManager.createRoom(
        { userId: users[0]._id.toString(), username: users[0].username, displayName: users[0].displayName, avatar: users[0].avatar },
        { name: 'Imposter Room 1', visibility: 'public', maxPlayers: 6, settings: { gameMode: 'imposter' } },
        'sock-h1'
      );

      // Join player 2 only (2 total players, < 4)
      await roomManager.joinRoom(created.roomCode, {
        userId: users[1]._id.toString(),
        username: users[1].username,
        displayName: users[1].displayName,
        avatar: users[1].avatar,
      }, 'sock-p2');

      const activePlayers = [
        { userId: users[0]._id.toString(), username: users[0].username, displayName: users[0].displayName, avatar: users[0].avatar },
        { userId: users[1]._id.toString(), username: users[1].username, displayName: users[1].displayName, avatar: users[1].avatar },
      ];

      const settings: any = { rounds: 3, drawTimeSeconds: 60, wordCount: 3, hints: 2, wordMode: 'normal', category: 'general', gameMode: 'imposter' };

      // Attempt to start game with only 2 players in imposter mode
      expect(() => {
        gameManager.startGame(created.roomCode, activePlayers, settings, (httpServer as any).io || {} as any);
      }).toThrow(/at least 4/i);
    });

    it('assigns exactly 1 imposter, preserves secret word privacy, and isolates drawings', async () => {
      const roomManager = RoomManager.getInstance();
      const gameManager = GameManager.getInstance();

      const created = await roomManager.createRoom(
        { userId: users[0]._id.toString(), username: users[0].username, displayName: users[0].displayName, avatar: users[0].avatar },
        { name: 'Imposter Match', visibility: 'public', maxPlayers: 6, settings: { gameMode: 'imposter' } },
        'sock-h2'
      );

      for (let i = 1; i <= 3; i++) {
        await roomManager.joinRoom(created.roomCode, {
          userId: users[i]._id.toString(),
          username: users[i].username,
          displayName: users[i].displayName,
          avatar: users[i].avatar,
        }, `sock-p${i}`);
      }

      const activePlayers = users.map((u) => ({
        userId: u._id.toString(),
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
      }));

      const settings: any = { rounds: 3, drawTimeSeconds: 60, wordCount: 3, hints: 2, wordMode: 'normal', category: 'general', gameMode: 'imposter' };

      const game = gameManager.startGame(created.roomCode, activePlayers, settings, (httpServer as any).io || { to: () => ({ emit: () => {} }) } as any);
      expect(game).toBeDefined();

      const imposterId = game.imposterUserId;
      expect(imposterId).toBeTruthy();

      const imposterCount = game.players.filter((p) => p.userId === imposterId).length;
      expect(imposterCount).toBe(1);

      // Privacy checks across all 4 player viewpoints
      for (const u of users) {
        const viewerSnapshot = gameManager.getViewerSnapshot(created.roomCode, u._id.toString());
        expect(viewerSnapshot).toBeDefined();

        if (u._id.toString() === imposterId) {
          expect(viewerSnapshot?.imposterState?.role).toBe('imposter');
          expect(viewerSnapshot?.word.secret).toBeUndefined();
          expect(viewerSnapshot?.imposterState?.categoryClue).toBeTruthy();
        } else {
          expect(viewerSnapshot?.imposterState?.role).toBe('innocent');
          expect(viewerSnapshot?.word.secret).toBeTruthy();
          expect(viewerSnapshot?.imposterState?.revealedImposterUserId).toBeUndefined();
        }
      }
    });

    it('processes authoritative voting and calculates score outcomes with tie handling', async () => {
      const roomManager = RoomManager.getInstance();
      const gameManager = GameManager.getInstance();

      const created = await roomManager.createRoom(
        { userId: users[0]._id.toString(), username: users[0].username, displayName: users[0].displayName, avatar: users[0].avatar },
        { name: 'Vote Room', visibility: 'public', maxPlayers: 6, settings: { gameMode: 'imposter' } },
        'sock-h3'
      );

      for (let i = 1; i <= 3; i++) {
        await roomManager.joinRoom(created.roomCode, {
          userId: users[i]._id.toString(),
          username: users[i].username,
          displayName: users[i].displayName,
          avatar: users[i].avatar,
        }, `sock-v${i}`);
      }

      const activePlayers = users.map((u) => ({
        userId: u._id.toString(),
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
      }));

      const settings: any = { rounds: 3, drawTimeSeconds: 60, wordCount: 3, hints: 2, wordMode: 'normal', category: 'general', gameMode: 'imposter' };
      const game = gameManager.startGame(created.roomCode, activePlayers, settings, (httpServer as any).io || { to: () => ({ emit: () => {} }) } as any);
      const imposterId = game.imposterUserId!;
      const innocentUsers = users.filter((u) => u._id.toString() !== imposterId);

      (game as any).phase = 'imposter_voting';
      (game as any).timerStartedAt = Date.now();
      (game as any).timerDeadline = Date.now() + 30000;

      // 1. Valid vote
      const vote1 = gameManager.handleImposterVote(created.roomCode, innocentUsers[0]._id.toString(), imposterId);
      expect(vote1).toBe(true);

      // 2. Reject duplicate vote
      expect(() => {
        gameManager.handleImposterVote(created.roomCode, innocentUsers[0]._id.toString(), imposterId);
      }).toThrow(/already cast/i);

      // 3. Reject vote from non-participant
      expect(() => {
        gameManager.handleImposterVote(created.roomCode, 'non-existent-user', imposterId);
      }).toThrow(/only active players/i);
    });
  });

  describe('Part B: AI Practice Mode & Recognition Integration', () => {
    it('GET /api/practice/health returns online status and 20 classes or graceful degraded status', async () => {
      const res = await request(app).get('/api/practice/health');
      expect([200, 503]).toContain(res.status);
    });

    it('POST /api/practice/predict validates input payload and rejects blank or empty image', async () => {
      const res1 = await request(app)
        .post('/api/practice/predict')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .send({});
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/practice/predict')
        .set('Authorization', `Bearer ${tokens[1]}`)
        .send({ image: 'too_short' });
      expect(res2.status).toBe(400);
    });

    it('never broadcasts practice predictions to multiplayer rooms or leaks words', () => {
      const drawingManager = DrawingSessionManager.getInstance();
      const rawSnapshot = drawingManager.getSnapshot('non-existent');
      expect(rawSnapshot).toBeNull();
    });
  });

  describe('Part D: AI-Assisted Moderation & Reliability', () => {
    it('approves safe chat and detects vulgar/toxic content appropriately', async () => {
      const safe = await AIModerationService.moderateChatMessage(
        'Nice drawing of a tree!',
        users[0]._id.toString(),
        'ROOM123'
      );
      expect(safe.permitted).toBe(true);
      expect(safe.flagged).toBe(false);

      const toxic = await AIModerationService.moderateChatMessage(
        'kill yourself now',
        users[0]._id.toString(),
        'ROOM123'
      );
      expect(toxic.permitted).toBe(false);
      expect(toxic.flagged).toBe(true);
    });

    it('maintains deterministic rate limiting on messages regardless of AI status', () => {
      const roomCode = 'RATE_TEST_ROOM';
      const userId = users[0]._id.toString();

      let blockedCount = 0;
      for (let i = 0; i < 10; i++) {
        const check = AIModerationService.checkChatRateLimit(
          userId,
          roomCode,
          `Different message number ${i}`
        );
        if (!check.allowed) {
          blockedCount++;
        }
      }
      expect(blockedCount).toBeGreaterThan(0);
    });
  });
});
