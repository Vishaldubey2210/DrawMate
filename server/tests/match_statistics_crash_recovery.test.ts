import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { MatchResult } from '../src/models/MatchResult.js';
import { MatchHistoryService, FinalizeMatchParams } from '../src/services/MatchHistoryService.js';
import { hashPassword } from '../src/utils/password.js';

describe('Match Statistics: Deterministic Fault-Injection & Crash Recovery (SE-3 Reaudit)', () => {
  let player1: any;
  let player2: any;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: { $in: ['crash_p1@test.com', 'crash_p2@test.com'] } });
    await MatchResult.deleteMany({ gameId: { $regex: /^crash-test-/ } });

    const pwd = await hashPassword('CrashTestPassword123!');
    player1 = await User.create({
      displayName: 'Crash Player 1',
      username: 'crash_p1',
      normalizedUsername: 'crash_p1',
      email: 'crash_p1@test.com',
      normalizedEmail: 'crash_p1@test.com',
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

    player2 = await User.create({
      displayName: 'Crash Player 2',
      username: 'crash_p2',
      normalizedUsername: 'crash_p2',
      email: 'crash_p2@test.com',
      normalizedEmail: 'crash_p2@test.com',
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
    await User.deleteMany({ email: { $in: ['crash_p1@test.com', 'crash_p2@test.com'] } });
    await MatchResult.deleteMany({ gameId: { $regex: /^crash-test-/ } });
    await disconnectDB();
  });

  it('1. Simulates crash after Player 1 is updated but before Player 2 or MatchResult completes; retry recovers safely', async () => {
    const gameId = 'crash-test-midway-fail-1';
    const params: FinalizeMatchParams = {
      gameId,
      roomCode: 'CRSH01',
      rounds: 3,
      category: 'general',
      players: [
        {
          userId: player1._id.toString(),
          username: player1.username,
          displayName: player1.displayName,
          score: 100,
          rank: 1,
          correctGuesses: 3,
          drawingTurns: 1,
        },
        {
          userId: player2._id.toString(),
          username: player2.username,
          displayName: player2.displayName,
          score: 50,
          rank: 2,
          correctGuesses: 1,
          drawingTurns: 1,
        },
      ],
      winner: {
        userId: player1._id.toString(),
        displayName: player1.displayName,
        score: 100,
      },
      startedAt: new Date(Date.now() - 120000),
      completedAt: new Date(),
    };

    // Step A: Manually inject the crash state
    // Create unfinalized MatchResult with statsApplied: false and NO appliedPlayerIds
    const match = await MatchResult.create({
      gameId,
      roomCode: params.roomCode,
      rounds: params.rounds,
      category: params.category,
      players: params.players,
      winner: params.winner,
      startedAt: params.startedAt,
      completedAt: params.completedAt,
      status: 'completed',
      statsApplied: false,
      appliedPlayerIds: [],
    });

    // Manually apply Player 1's atomic update (as if process crashed right after this single write)
    await User.findOneAndUpdate(
      { _id: player1._id, processedMatchIds: { $ne: gameId } },
      {
        $inc: {
          'stats.gamesPlayed': 1,
          'stats.wins': 1,
          'stats.currentStreak': 1,
          'stats.totalScore': 100,
          'stats.correctGuesses': 3,
          'stats.drawingTurns': 1,
        },
        $max: { 'stats.highestScore': 100 },
        $push: { processedMatchIds: { $each: [gameId], $slice: -100 } },
      }
    );

    // Verify Player 1 has 1 game played and Player 2 has 0
    let p1Check = await User.findById(player1._id);
    let p2Check = await User.findById(player2._id);
    expect(p1Check?.stats.gamesPlayed).toBe(1);
    expect(p2Check?.stats.gamesPlayed).toBe(0);

    // Step B: Application recovers and invokes finalizeMatch retry
    await MatchHistoryService.finalizeMatch(params);

    // Step C: Verify invariants
    p1Check = await User.findById(player1._id);
    p2Check = await User.findById(player2._id);
    const updatedMatch = await MatchResult.findOne({ gameId });

    // Player 1 must NOT be double-counted!
    expect(p1Check?.stats.gamesPlayed).toBe(1);
    expect(p1Check?.stats.wins).toBe(1);
    expect(p1Check?.stats.totalScore).toBe(100);

    // Player 2 must have their stats applied now!
    expect(p2Check?.stats.gamesPlayed).toBe(1);
    expect(p2Check?.stats.losses).toBe(1);
    expect(p2Check?.stats.totalScore).toBe(50);

    // Match must now be fully marked complete
    expect(updatedMatch?.statsApplied).toBe(true);
    expect(updatedMatch?.appliedPlayerIds).toContain(player1._id.toString());
    expect(updatedMatch?.appliedPlayerIds).toContain(player2._id.toString());
  });

  it('2. Simulates crash after all players updated but before statsApplied is committed; retry sets flag idempotently', async () => {
    const gameId = 'crash-test-pre-flag-commit-2';
    const params: FinalizeMatchParams = {
      gameId,
      roomCode: 'CRSH02',
      rounds: 2,
      category: 'animals',
      players: [
        {
          userId: player1._id.toString(),
          username: player1.username,
          displayName: player1.displayName,
          score: 80,
          rank: 2,
          correctGuesses: 2,
          drawingTurns: 1,
        },
        {
          userId: player2._id.toString(),
          username: player2.username,
          displayName: player2.displayName,
          score: 120,
          rank: 1,
          correctGuesses: 4,
          drawingTurns: 1,
        },
      ],
      winner: {
        userId: player2._id.toString(),
        displayName: player2.displayName,
        score: 120,
      },
      startedAt: new Date(Date.now() - 90000),
      completedAt: new Date(),
    };

    // Pre-state: MatchResult exists with statsApplied: false
    await MatchResult.create({
      gameId,
      roomCode: params.roomCode,
      rounds: params.rounds,
      category: params.category,
      players: params.players,
      winner: params.winner,
      startedAt: params.startedAt,
      completedAt: params.completedAt,
      status: 'completed',
      statsApplied: false,
      appliedPlayerIds: [player1._id.toString(), player2._id.toString()],
    });

    // Users already have gameId in their processedMatchIds
    await User.findByIdAndUpdate(player1._id, {
      $inc: { 'stats.gamesPlayed': 1, 'stats.losses': 1, 'stats.totalScore': 80 },
      $push: { processedMatchIds: { $each: [gameId], $slice: -100 } },
    });
    await User.findByIdAndUpdate(player2._id, {
      $inc: { 'stats.gamesPlayed': 1, 'stats.wins': 1, 'stats.totalScore': 120 },
      $push: { processedMatchIds: { $each: [gameId], $slice: -100 } },
    });

    const p1Before = await User.findById(player1._id);
    const p2Before = await User.findById(player2._id);
    const p1GamesBefore = p1Before?.stats.gamesPlayed || 0;
    const p2GamesBefore = p2Before?.stats.gamesPlayed || 0;

    // Retry execution
    await MatchHistoryService.finalizeMatch(params);

    const p1After = await User.findById(player1._id);
    const p2After = await User.findById(player2._id);
    const matchDoc = await MatchResult.findOne({ gameId });

    // Zero double counts
    expect(p1After?.stats.gamesPlayed).toBe(p1GamesBefore);
    expect(p2After?.stats.gamesPlayed).toBe(p2GamesBefore);
    // Flag is now committed
    expect(matchDoc?.statsApplied).toBe(true);
  });

  it('3. Scenario 8 verification: Retry after gameId has aged out of user bounded history (>-100 items)', async () => {
    const historicalGameId = 'crash-test-historical-ancient-match';
    const params: FinalizeMatchParams = {
      gameId: historicalGameId,
      roomCode: 'ANCIENT',
      rounds: 1,
      category: 'history',
      players: [
        {
          userId: player1._id.toString(),
          username: player1.username,
          displayName: player1.displayName,
          score: 40,
          rank: 1,
          correctGuesses: 1,
          drawingTurns: 1,
        },
      ],
      winner: {
        userId: player1._id.toString(),
        displayName: player1.displayName,
        score: 40,
      },
      startedAt: new Date(Date.now() - 500000),
      completedAt: new Date(),
    };

    // Match was finalized and recorded in MatchResult with statsApplied: true
    await MatchResult.create({
      gameId: historicalGameId,
      roomCode: params.roomCode,
      rounds: params.rounds,
      category: params.category,
      players: params.players,
      winner: params.winner,
      startedAt: params.startedAt,
      completedAt: params.completedAt,
      status: 'completed',
      statsApplied: true,
      appliedPlayerIds: [player1._id.toString()],
    });

    // Simulate 105 other matches pushing into player1's processedMatchIds,
    // so historicalGameId is no longer in player1's processedMatchIds array
    const dummyMatches = Array.from({ length: 105 }, (_, i) => `dummy-match-${i}`);
    await User.findByIdAndUpdate(player1._id, {
      $set: { processedMatchIds: dummyMatches.slice(-100) },
    });

    const p1Before = await User.findById(player1._id);
    expect(p1Before?.processedMatchIds).not.toContain(historicalGameId);
    const gamesBefore = p1Before?.stats.gamesPlayed;

    // Retry arrives for the historical match
    const result = await MatchHistoryService.finalizeMatch(params);

    // Verify early-return guard protected against double counting
    expect(result.statsApplied).toBe(true);
    const p1After = await User.findById(player1._id);
    expect(p1After?.stats.gamesPlayed).toBe(gamesBefore);
  });

  it('4. Scenario 7 verification: Two different matches for the same player finish concurrently without lost updates', async () => {
    const p1Initial = await User.findById(player1._id);
    const initialGames = p1Initial?.stats.gamesPlayed || 0;
    const initialScore = p1Initial?.stats.totalScore || 0;

    const matchAParams: FinalizeMatchParams = {
      gameId: 'crash-concurrent-match-A',
      roomCode: 'CONC_A',
      rounds: 2,
      category: 'nature',
      players: [
        {
          userId: player1._id.toString(),
          username: player1.username,
          displayName: player1.displayName,
          score: 75,
          rank: 1,
          correctGuesses: 2,
          drawingTurns: 1,
        },
      ],
      winner: {
        userId: player1._id.toString(),
        displayName: player1.displayName,
        score: 75,
      },
      startedAt: new Date(),
      completedAt: new Date(),
    };

    const matchBParams: FinalizeMatchParams = {
      gameId: 'crash-concurrent-match-B',
      roomCode: 'CONC_B',
      rounds: 2,
      category: 'science',
      players: [
        {
          userId: player1._id.toString(),
          username: player1.username,
          displayName: player1.displayName,
          score: 25,
          rank: 2,
          correctGuesses: 1,
          drawingTurns: 1,
        },
      ],
      winner: {
        userId: 'some-other-user',
        displayName: 'Other',
        score: 90,
      },
      startedAt: new Date(),
      completedAt: new Date(),
    };

    // Execute concurrently
    await Promise.all([
      MatchHistoryService.finalizeMatch(matchAParams),
      MatchHistoryService.finalizeMatch(matchBParams),
    ]);

    const p1Final = await User.findById(player1._id);
    // Both matches must be reflected in gamesPlayed and score!
    expect(p1Final?.stats.gamesPlayed).toBe(initialGames + 2);
    expect(p1Final?.stats.totalScore).toBe(initialScore + 100);
    expect(p1Final?.processedMatchIds).toContain('crash-concurrent-match-A');
    expect(p1Final?.processedMatchIds).toContain('crash-concurrent-match-B');
  });
});
