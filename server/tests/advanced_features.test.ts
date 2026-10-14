import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import request from 'supertest';
import { app } from '../src/app.js';
import { setupRealtimeServer } from '../src/realtime/socket.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Room } from '../src/models/Room.js';
import { CustomWordPack } from '../src/models/CustomWordPack.js';
import { RoundTelemetry } from '../src/models/RoundTelemetry.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { hashPassword } from '../src/utils/password.js';
import { RoomManager } from '../src/services/RoomManager.js';
import { DrawingSessionManager } from '../src/services/DrawingSessionManager.js';
import { GameManager } from '../src/game/GameManager.js';
import { WordService } from '../src/game/WordService.js';
import { TelemetryService } from '../src/services/TelemetryService.js';
import { GenAIProviderService } from '../src/services/GenAIProviderService.js';
import { runDifficultyModelEvaluation } from '../src/scripts/evaluate_difficulty_model.js';

describe('Advanced Feature Integration — Reconnect, Mobile Redo, Fair Play, GenAI & Adaptive Selection', () => {
  let httpServer: HttpServer;
  let serverPort: number;

  let userA: any;
  let tokenA: string;
  let userB: any;
  let tokenB: string;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({});
    await Room.deleteMany({});
    await CustomWordPack.deleteMany({});
    await RoundTelemetry.deleteMany({});
    await AuditLog.deleteMany({});

    const pwdHash = await hashPassword('Secret123!');

    userA = await User.create({
      displayName: 'Alice Host',
      username: 'alice_host',
      normalizedUsername: 'alice_host',
      email: 'alice@test.com',
      normalizedEmail: 'alice@test.com',
      passwordHash: pwdHash,
      avatar: 'avatar-1',
      isOnboarded: true,
    });

    userB = await User.create({
      displayName: 'Bob Player',
      username: 'bob_player',
      normalizedUsername: 'bob_player',
      email: 'bob@test.com',
      normalizedEmail: 'bob@test.com',
      passwordHash: pwdHash,
      avatar: 'avatar-2',
      isOnboarded: true,
    });

    tokenA = signAccessToken({
      userId: userA._id.toString(),
      username: userA.username,
      displayName: userA.displayName,
      avatar: userA.avatar,
    });

    tokenB = signAccessToken({
      userId: userB._id.toString(),
      username: userB.username,
      displayName: userB.displayName,
      avatar: userB.avatar,
    });

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

  const createSocket = (token: string): ClientSocketType => {
    return ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
  };

  describe('Feature A: Smart Reconnect & Room Recovery', () => {
    it('allows an existing participant to reconnect while room is in_game without error', async () => {
      const roomManager = RoomManager.getInstance();
      const created = await roomManager.createRoom(
        { userId: userA._id.toString(), username: userA.username, displayName: userA.displayName, avatar: userA.avatar },
        { name: 'Active Game Room', visibility: 'public', maxPlayers: 6 },
        'socket_a_1'
      );
      const code = created.roomCode;

      await roomManager.joinRoom(
        code,
        { userId: userB._id.toString(), username: userB.username, displayName: userB.displayName, avatar: userB.avatar },
        'socket_b_1'
      );

      // Simulate match in progress
      const room = await roomManager.getOrHydrateRoom(code);
      room!.status = 'in_game';

      // Bob disconnects unexpectedly
      await roomManager.handlePlayerLeave(code, userB._id.toString(), false);

      const postLeaveSnapshot = roomManager.getSanitizedSnapshot(code)!;
      const bobInRoom = postLeaveSnapshot.players.find((p) => p.userId === userB._id.toString());
      expect(bobInRoom?.isDisconnected).toBe(true);

      // Bob reconnects with a new socket during in_game status
      const reconnectResult = await roomManager.joinRoom(
        code,
        { userId: userB._id.toString(), username: userB.username, displayName: userB.displayName, avatar: userB.avatar },
        'socket_b_2'
      );

      expect(reconnectResult.isReconnect).toBe(true);
      const bobRestored = reconnectResult.snapshot.players.find((p) => p.userId === userB._id.toString());
      expect(bobRestored?.isDisconnected).toBe(false);
      expect(reconnectResult.snapshot.players.filter((p) => p.userId === userB._id.toString()).length).toBe(1);
    });

    it('protects against delayed disconnect callback kicking a reconnected user', async () => {
      const roomManager = RoomManager.getInstance();
      roomManager.disconnectGracePeriodMs = 50; // fast test threshold

      const created = await roomManager.createRoom(
        { userId: userA._id.toString(), username: userA.username, displayName: userA.displayName, avatar: userA.avatar },
        { name: 'Grace Room', visibility: 'public' },
        's_a'
      );
      const code = created.roomCode;

      await roomManager.joinRoom(
        code,
        { userId: userB._id.toString(), username: userB.username, displayName: userB.displayName, avatar: userB.avatar },
        's_b'
      );

      // Disconnect Bob
      await roomManager.handlePlayerLeave(code, userB._id.toString(), false);

      // Bob immediately reconnects before timer expiration
      await roomManager.joinRoom(
        code,
        { userId: userB._id.toString(), username: userB.username, displayName: userB.displayName, avatar: userB.avatar },
        's_b_reconnected'
      );

      // Wait beyond the grace period
      await new Promise((r) => setTimeout(r, 70));

      // Bob must still be in the room!
      const snap = roomManager.getSanitizedSnapshot(code)!;
      const bob = snap.players.find((p) => p.userId === userB._id.toString());
      expect(bob).toBeDefined();
      expect(bob?.isDisconnected).toBe(false);

      // Restore default grace period
      roomManager.disconnectGracePeriodMs = 30000;
    });

    it('cancels active stroke when drawer disconnects', () => {
      const drawingManager = DrawingSessionManager.getInstance();
      const testRoom = 'RM_CANCEL_STROKE';

      drawingManager.setDrawer(testRoom, userA._id.toString());
      drawingManager.startStroke(testRoom, userA._id.toString(), {
        strokeId: 'str_dropped',
        tool: 'brush',
        color: '#000000',
        width: 4,
        point: { x: 0.1, y: 0.1 },
      });

      expect(drawingManager.getActiveStroke(testRoom)).toBeDefined();

      // Drawer dropped
      drawingManager.cancelActiveStroke(testRoom, userA._id.toString());
      expect(drawingManager.getActiveStroke(testRoom)).toBeNull();
    });
  });

  describe('Feature B: Mobile-First Drawing Experience & Redo', () => {
    it('supports server-authoritative redo and branch invalidation on new stroke', () => {
      const dm = DrawingSessionManager.getInstance();
      const testRoom = 'RM_REDO_TEST';
      const drawerId = userA._id.toString();

      dm.setDrawer(testRoom, drawerId);

      // Add 2 strokes
      dm.startStroke(testRoom, drawerId, {
        strokeId: 's1',
        tool: 'brush',
        color: '#000',
        width: 2,
        point: { x: 0.1, y: 0.1 },
      });
      dm.endStroke(testRoom, drawerId, 's1');

      dm.startStroke(testRoom, drawerId, {
        strokeId: 's2',
        tool: 'brush',
        color: '#000',
        width: 2,
        point: { x: 0.2, y: 0.2 },
      });
      dm.endStroke(testRoom, drawerId, 's2');

      expect(dm.getSnapshot(testRoom)!.strokes.length).toBe(2);

      // Undo stroke 2
      const undoResult = dm.undo(testRoom, drawerId);
      expect(undoResult.removedStrokeId).toBe('s2');
      expect(dm.getSnapshot(testRoom)!.strokes.length).toBe(1);

      // Redo stroke 2
      const redoResult = dm.redo(testRoom, drawerId);
      expect(redoResult.restoredStroke.strokeId).toBe('s2');
      expect(dm.getSnapshot(testRoom)!.strokes.length).toBe(2);

      // Undo again, then draw a NEW stroke s3 -> redo stack must be invalidated
      dm.undo(testRoom, drawerId);
      dm.startStroke(testRoom, drawerId, {
        strokeId: 's3',
        tool: 'brush',
        color: '#ff0000',
        width: 4,
        point: { x: 0.3, y: 0.3 },
      });
      dm.endStroke(testRoom, drawerId, 's3');

      // Attempting redo now should throw because branch was invalidated
      expect(() => dm.redo(testRoom, drawerId)).toThrow(/Nothing to redo/);
      expect(dm.getSnapshot(testRoom)!.strokes.length).toBe(2);
      expect(dm.getSnapshot(testRoom)!.strokes.map((s) => s.strokeId)).toEqual(['s1', 's3']);
    });
  });

  describe('Feature C: Fair Play, AFK Protection & Anti-Abuse', () => {
    it('enforces guess rate limiting and duplicate guess rejection', async () => {
      const client = createSocket(tokenB);

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.emit('room:create', { name: 'Rate Limit Room' }, (createRes: any) => {
            const roomCode = createRes.room.roomCode;

            // Rapid burst of 7 guesses
            let errorsCount = 0;
            client.on('game:error', (err: any) => {
              if (err.error.includes('rate limit') || err.error.includes('Duplicate')) {
                errorsCount++;
              }
            });

            for (let i = 0; i < 7; i++) {
              client.emit('game:guess', { roomCode, text: 'apple' });
            }

            setTimeout(() => {
              expect(errorsCount).toBeGreaterThan(0);
              client.disconnect();
              resolve();
            }, 300);
          });
        });
      });
    });

    it('allows room host to kick a participant and prevents kicked user from rejoining', async () => {
      const roomManager = RoomManager.getInstance();

      const created = await roomManager.createRoom(
        { userId: userA._id.toString(), username: userA.username, displayName: userA.displayName, avatar: userA.avatar },
        { name: 'Kick Test Room', visibility: 'public' },
        's_host'
      );
      const code = created.roomCode;

      await roomManager.joinRoom(
        code,
        { userId: userB._id.toString(), username: userB.username, displayName: userB.displayName, avatar: userB.avatar },
        's_target'
      );

      // Non-host attempts to kick host -> must fail
      await expect(
        roomManager.kickPlayer(code, userB._id.toString(), userA._id.toString(), 'Trolling')
      ).rejects.toThrow(/Unauthorized/);

      // Host kicks participant Bob
      const kickRes = await roomManager.kickPlayer(code, userA._id.toString(), userB._id.toString(), 'Inactivity');
      expect(kickRes.snapshot.players.some((p) => p.userId === userB._id.toString())).toBe(false);

      // Bob attempts to rejoin -> rejected
      await expect(
        roomManager.joinRoom(
          code,
          { userId: userB._id.toString(), username: userB.username, displayName: userB.displayName, avatar: userB.avatar },
          's_target_new'
        )
      ).rejects.toThrow(/kicked from this room/);
    });
  });

  describe('Feature D: GenAI Word-Pack Generator', () => {
    it('generates a structured, validated word pack with mock heuristic fallback', async () => {
      const result = await GenAIProviderService.generateWordPack({
        theme: 'Bollywood Classic Movies',
        language: 'hi',
        count: 15,
        difficulty: 'medium',
        category: 'movies',
      });

      expect(result.theme).toBe('Bollywood Classic Movies');
      expect(result.language).toBe('hi');
      expect(result.words.length).toBeGreaterThanOrEqual(10);
      expect(result.wordDetails.length).toBe(result.words.length);
      expect(result.words.every((w) => typeof w === 'string' && w.length >= 2)).toBe(true);
      // Deduplicated
      const unique = new Set(result.words.map((w) => w.toLowerCase()));
      expect(unique.size).toBe(result.words.length);
    });

    it('provides REST endpoint POST /api/word-packs/generate', async () => {
      const res = await request(app)
        .post('/api/word-packs/generate')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          theme: 'Outer Space & Planets',
          language: 'en',
          count: 12,
          difficulty: 'mixed',
          category: 'space',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.words.length).toBe(12);
      expect(res.body.data.packName).toBeDefined();
    });
  });

  describe('Feature E: Smart Word Selection & Adaptive Difficulty', () => {
    it('records telemetry and computes Bayesian smoothed solve rates', async () => {
      const testWord = 'chameleon';
      const lang = 'en';

      // Record 3 rounds: 2 solved, 1 timed out
      await TelemetryService.recordRound({
        gameId: 'g_t1',
        roomCode: 'RM_TEL',
        roundNumber: 1,
        word: testWord,
        language: lang,
        roundDurationSeconds: 40,
        timeToFirstCorrectGuessSeconds: 22,
        totalGuessesCount: 4,
        correctGuessersCount: 1,
        incorrectGuessesCount: 3,
        timedOut: false,
        solved: true,
        eligiblePlayersCount: 3,
      });

      await TelemetryService.recordRound({
        gameId: 'g_t2',
        roomCode: 'RM_TEL',
        roundNumber: 2,
        word: testWord,
        language: lang,
        roundDurationSeconds: 35,
        timeToFirstCorrectGuessSeconds: 18,
        totalGuessesCount: 3,
        correctGuessersCount: 1,
        incorrectGuessesCount: 2,
        timedOut: false,
        solved: true,
        eligiblePlayersCount: 3,
      });

      await TelemetryService.recordRound({
        gameId: 'g_t3',
        roomCode: 'RM_TEL',
        roundNumber: 3,
        word: testWord,
        language: lang,
        roundDurationSeconds: 60,
        timeToFirstCorrectGuessSeconds: null,
        totalGuessesCount: 5,
        correctGuessersCount: 0,
        incorrectGuessesCount: 5,
        timedOut: true,
        solved: false,
        eligiblePlayersCount: 3,
      });

      const metrics = await TelemetryService.getWordMetrics(testWord, lang);
      expect(metrics.roundsObserved).toBe(3);
      expect(metrics.solves).toBe(2);
      expect(metrics.timeouts).toBe(1);

      // Bayesian smoothing: (solves + 2) / (rounds + 4) = (2 + 2) / (3 + 4) = 4/7 ~ 0.5714
      expect(metrics.smoothedSolveRate).toBeCloseTo(4 / 7, 3);
      expect(metrics.empiricalDifficulty).toBe('medium');
    });

    it('penalizes words with severe timeout rate in adaptive weighting', () => {
      const chronicTimeoutMetrics = {
        word: 'labyrinth',
        language: 'en',
        roundsObserved: 6,
        solves: 1,
        timeouts: 5,
        rawSolveRate: 1 / 6,
        smoothedSolveRate: 3 / 10,
        timeoutRate: 5 / 6, // 83% timeouts
        empiricalDifficulty: 'hard' as const,
        avgDurationSeconds: 60,
      };

      const weight = TelemetryService.calculateAdaptiveWeight(chronicTimeoutMetrics);
      expect(weight).toBeLessThan(0.5); // Demoted so players aren't frustrated repeatedly
    });

    it('WordService filters by difficulty and excludes recently used words', () => {
      const choices = WordService.getWordChoices({
        language: 'en',
        count: 3,
        difficulty: 'easy',
        excludeWords: ['cat', 'dog'],
      });

      expect(choices.length).toBe(3);
      expect(choices.includes('cat')).toBe(false);
      expect(choices.includes('dog')).toBe(false);
    });

    it('executes offline difficulty model evaluation report without errors', async () => {
      const report = await runDifficultyModelEvaluation();
      expect(report.datasetSize).toBeGreaterThanOrEqual(0);
      expect(report.readinessCriteria.status).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });
});
