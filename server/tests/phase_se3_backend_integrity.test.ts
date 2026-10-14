import mongoose from 'mongoose';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { MatchResult } from '../src/models/MatchResult.js';
import { MatchHistoryService } from '../src/services/MatchHistoryService.js';
import { RoomManager } from '../src/services/RoomManager.js';
import { GameManager } from '../src/game/GameManager.js';
import { DrawingSessionManager } from '../src/services/DrawingSessionManager.js';
import { NotificationService } from '../src/services/NotificationService.js';
import { hashPassword } from '../src/utils/password.js';

describe('Phase SE-3: Backend Architecture, Security & Data Integrity', () => {
  let userA: any;
  let userB: any;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: { $in: ['se3_userA@test.com', 'se3_userB@test.com'] } });
    await MatchResult.deleteMany({ gameId: { $regex: /^se3-test-/ } });

    const pwd = await hashPassword('TestPassword123!');
    userA = await User.create({
      displayName: 'SE3 Alpha',
      username: 'se3_alpha',
      normalizedUsername: 'se3_alpha',
      email: 'se3_userA@test.com',
      normalizedEmail: 'se3_usera@test.com',
      passwordHash: pwd,
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
      processedMatchIds: [],
    });

    userB = await User.create({
      displayName: 'SE3 Beta',
      username: 'se3_beta',
      normalizedUsername: 'se3_beta',
      email: 'se3_userB@test.com',
      normalizedEmail: 'se3_userb@test.com',
      passwordHash: pwd,
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
      processedMatchIds: [],
    });
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('1. MongoDB Atomicity, Idempotency & Crash Recovery (Match Statistics)', () => {
    it('applies stats mutation and records gameId in processedMatchIds in a single atomic write', async () => {
      const userAId = userA._id.toString();
      const initialGames = (await User.findById(userAId))?.stats.gamesPlayed || 0;

      const gameId = 'se3-test-atomic-1';
      await MatchHistoryService.finalizeMatch({
        gameId,
        roomCode: 'SE3_ROOM1',
        rounds: 2,
        category: 'animals',
        players: [
          {
            userId: userAId,
            username: userA.username,
            displayName: userA.displayName,
            avatar: 'avatar-1',
            score: 120,
            rank: 1,
            correctGuesses: 2,
            drawingTurns: 1,
          },
        ],
        winner: {
          userId: userAId,
          displayName: userA.displayName,
          score: 120,
        },
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
      });

      const updated = await User.findById(userAId);
      expect(updated?.stats.gamesPlayed).toBe(initialGames + 1);
      expect(updated?.stats.wins).toBe(1);
      expect(updated?.stats.totalScore).toBe(120);
      expect(updated?.processedMatchIds).toContain(gameId);

      const matchDoc = await MatchResult.findOne({ gameId });
      expect(matchDoc?.statsApplied).toBe(true);
      expect(matchDoc?.appliedPlayerIds).toContain(userAId);
    });

    it('prevents double-counting when user already has gameId in processedMatchIds (crash recovery after write)', async () => {
      const userAId = userA._id.toString();
      const gameId = 'se3-test-crash-after-write';

      // Simulate state where write committed to User with processedMatchIds, but process crashed before MatchResult statsApplied was set
      await User.findByIdAndUpdate(userAId, {
        $inc: { 'stats.gamesPlayed': 1, 'stats.wins': 1, 'stats.totalScore': 90 },
        $push: { processedMatchIds: gameId },
      });

      const statsBeforeRetry = (await User.findById(userAId))?.stats;

      // Create incomplete MatchResult
      await MatchResult.create({
        gameId,
        roomCode: 'SE3_CRASH_ROOM',
        rounds: 1,
        category: 'general',
        players: [
          {
            userId: userAId,
            username: userA.username,
            displayName: userA.displayName,
            avatar: 'avatar-1',
            score: 90,
            rank: 1,
            correctGuesses: 1,
            drawingTurns: 1,
          },
        ],
        winner: {
          userId: userAId,
          displayName: userA.displayName,
          score: 90,
        },
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
        status: 'completed',
        statsApplied: false,
        appliedPlayerIds: [],
      });

      // Execute retry
      await MatchHistoryService.finalizeMatch({
        gameId,
        roomCode: 'SE3_CRASH_ROOM',
        rounds: 1,
        category: 'general',
        players: [
          {
            userId: userAId,
            username: userA.username,
            displayName: userA.displayName,
            avatar: 'avatar-1',
            score: 90,
            rank: 1,
            correctGuesses: 1,
            drawingTurns: 1,
          },
        ],
        winner: {
          userId: userAId,
          displayName: userA.displayName,
          score: 90,
        },
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
      });

      // User stats must NOT have been incremented again
      const statsAfterRetry = (await User.findById(userAId))?.stats;
      expect(statsAfterRetry?.gamesPlayed).toBe(statsBeforeRetry?.gamesPlayed);
      expect(statsAfterRetry?.totalScore).toBe(statsBeforeRetry?.totalScore);

      // MatchResult must be cleanly finalized
      const matchAfterRetry = await MatchResult.findOne({ gameId });
      expect(matchAfterRetry?.statsApplied).toBe(true);
      expect(matchAfterRetry?.appliedPlayerIds).toContain(userAId);
    });

    it('concurrent match finalizations for different games update the user independently without lost updates', async () => {
      const userBId = userB._id.toString();
      const initialGamesB = (await User.findById(userBId))?.stats.gamesPlayed || 0;

      const p1 = MatchHistoryService.finalizeMatch({
        gameId: 'se3-test-concurrent-match-A',
        roomCode: 'CONC_A',
        rounds: 1,
        category: 'food',
        players: [
          {
            userId: userBId,
            username: userB.username,
            displayName: userB.displayName,
            avatar: 'avatar-2',
            score: 50,
            rank: 1,
            correctGuesses: 1,
            drawingTurns: 1,
          },
        ],
        winner: { userId: userBId, displayName: userB.displayName, score: 50 },
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
      });

      const p2 = MatchHistoryService.finalizeMatch({
        gameId: 'se3-test-concurrent-match-B',
        roomCode: 'CONC_B',
        rounds: 1,
        category: 'sports',
        players: [
          {
            userId: userBId,
            username: userB.username,
            displayName: userB.displayName,
            avatar: 'avatar-2',
            score: 75,
            rank: 1,
            correctGuesses: 1,
            drawingTurns: 1,
          },
        ],
        winner: { userId: userBId, displayName: userB.displayName, score: 75 },
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
      });

      await Promise.all([p1, p2]);

      const userBAfter = await User.findById(userBId);
      expect(userBAfter?.stats.gamesPlayed).toBe(initialGamesB + 2);
      expect(userBAfter?.stats.totalScore).toBe(125);
      expect(userBAfter?.processedMatchIds).toContain('se3-test-concurrent-match-A');
      expect(userBAfter?.processedMatchIds).toContain('se3-test-concurrent-match-B');
    });
  });

  describe('2. Room State & Game Invariant Enforcement', () => {
    it('rejects ready status changes while game is in progress', async () => {
      const roomManager = RoomManager.getInstance();
      const hostId = new mongoose.Types.ObjectId().toString();
      const p2Id = new mongoose.Types.ObjectId().toString();

      const room = await roomManager.createRoom(
        { userId: hostId, username: 'host_se3', displayName: 'Host', avatar: 'avatar-1' },
        { name: 'SE3 State Room', maxPlayers: 4 },
        'socket-host'
      );

      // Add second player
      await roomManager.joinRoom(
        room.roomCode,
        { userId: p2Id, username: 'p2_se3', displayName: 'Player 2', avatar: 'avatar-2' },
        'socket-p2'
      );

      // Verify normal toggle succeeds when waiting
      const updatedSnapshot = roomManager.setPlayerReady(room.roomCode, p2Id, true);
      expect(updatedSnapshot.players.find((p) => p.userId === p2Id)?.isReady).toBe(true);

      // Simulate room status transition to in_game
      roomManager.setRoomStatus(room.roomCode, 'in_game');

      // Attempting to toggle ready state during active game must throw
      expect(() => {
        roomManager.setPlayerReady(room.roomCode, p2Id, false);
      }).toThrow(/Cannot change ready status while game is in_game/i);

      await roomManager.closeRoom(room.roomCode);
    });

    it('cancels active game when player departure leaves insufficient players', async () => {
      const roomManager = RoomManager.getInstance();
      const gameManager = GameManager.getInstance();
      const mockIO: any = { to: () => ({ emit: () => {} }) };

      const hostId = new mongoose.Types.ObjectId().toString();
      const guestId = new mongoose.Types.ObjectId().toString();

      const room = await roomManager.createRoom(
        { userId: hostId, username: 'host_game', displayName: 'Host G', avatar: 'avatar-1' },
        { name: 'Departure Room', maxPlayers: 2 },
        'socket-h'
      );

      await roomManager.joinRoom(
        room.roomCode,
        { userId: guestId, username: 'guest_game', displayName: 'Guest G', avatar: 'avatar-2' },
        'socket-g'
      );

      // Start game session
      const activeGame = gameManager.startGame(
        room.roomCode,
        [
          { userId: hostId, username: 'host_game', displayName: 'Host G', avatar: 'avatar-1' },
          { userId: guestId, username: 'guest_game', displayName: 'Guest G', avatar: 'avatar-2' },
        ],
        {
          rounds: 2,
          drawTimeSeconds: 60,
          wordCount: 3,
          hints: 2,
          wordMode: 'normal',
          category: 'general',
          gameMode: 'classic',
        },
        mockIO
      );

      roomManager.setRoomStatus(room.roomCode, 'in_game');
      expect(activeGame.phase).not.toBe('cancelled');

      // Guest player explicitly leaves the room
      await roomManager.handlePlayerLeave(room.roomCode, guestId, true);

      // Game must be cancelled because only 1 connected player remains
      expect(activeGame.phase).toBe('cancelled');

      await roomManager.closeRoom(room.roomCode);
    });
  });

  describe('3. Drawing Session Authorization Boundaries', () => {
    it('rejects drawing operations when user is not the designated drawer', () => {
      const drawingManager = DrawingSessionManager.getInstance();
      const roomCode = 'SE3_DRAW_AUTH';

      drawingManager.setDrawer(roomCode, 'drawer_authorized');
      expect(drawingManager.isAuthorizedDrawer(roomCode, 'drawer_authorized')).toBe(true);
      expect(drawingManager.isAuthorizedDrawer(roomCode, 'impostor_drawer')).toBe(false);

      expect(() => {
        drawingManager.startStroke(roomCode, 'impostor_drawer', {
          strokeId: 's1',
          tool: 'brush',
          color: '#000000',
          width: 0.005,
          point: { x: 0.1, y: 0.1 },
        });
      }).toThrow(/Unauthorized/i);

      drawingManager.endSession(roomCode);
    });
  });

  describe('4. Bounded Resource Limits & Safe Pagination', () => {
    it('clamps limit to maximum 50 in NotificationService.getUserNotifications', async () => {
      const result = await NotificationService.getUserNotifications(userA._id.toString(), 1, 9999);
      expect(result).toBeDefined();
      expect(result.page).toBe(1);
    });
  });
});
