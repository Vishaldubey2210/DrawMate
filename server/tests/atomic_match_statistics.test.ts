import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { MatchResult } from '../src/models/MatchResult.js';
import { MatchHistoryService } from '../src/services/MatchHistoryService.js';
import { hashPassword } from '../src/utils/password.js';

describe('SE-03: Race-Safe & Idempotent Match Statistics Tests', () => {
  let testUserA: any;
  let testUserB: any;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: { $in: ['userA@test.com', 'userB@test.com'] } });
    await MatchResult.deleteMany({ gameId: { $regex: /^test-game-/ } });

    const pwd = await hashPassword('Test1234!');
    testUserA = await User.create({
      displayName: 'Player Alpha',
      username: 'player_alpha',
      normalizedUsername: 'player_alpha',
      email: 'userA@test.com',
      normalizedEmail: 'usera@test.com',
      passwordHash: pwd,
      bio: 'Original Alpha Bio',
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

    testUserB = await User.create({
      displayName: 'Player Beta',
      username: 'player_beta',
      normalizedUsername: 'player_beta',
      email: 'userB@test.com',
      normalizedEmail: 'userb@test.com',
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
    });
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('1. Two different matches completing concurrently for the same user accumulate both sets of statistics', async () => {
    const userAId = testUserA._id.toString();

    const match1Promise = MatchHistoryService.finalizeMatch({
      gameId: 'test-game-concurrent-1',
      roomCode: 'ROOM1',
      rounds: 3,
      category: 'animals',
      players: [
        {
          userId: userAId,
          username: testUserA.username,
          displayName: testUserA.displayName,
          avatar: 'avatar-1',
          score: 150,
          rank: 1,
          correctGuesses: 2,
          drawingTurns: 1,
        },
      ],
      winner: {
        userId: userAId,
        displayName: testUserA.displayName,
        score: 150,
      },
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
    });

    const match2Promise = MatchHistoryService.finalizeMatch({
      gameId: 'test-game-concurrent-2',
      roomCode: 'ROOM2',
      rounds: 3,
      category: 'food',
      players: [
        {
          userId: userAId,
          username: testUserA.username,
          displayName: testUserA.displayName,
          avatar: 'avatar-1',
          score: 250,
          rank: 1,
          correctGuesses: 3,
          drawingTurns: 1,
        },
      ],
      winner: {
        userId: userAId,
        displayName: testUserA.displayName,
        score: 250,
      },
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
    });

    await Promise.all([match1Promise, match2Promise]);

    const updatedUserA = await User.findById(userAId);
    expect(updatedUserA).toBeDefined();

    // Verify both matches were atomically accumulated with zero lost updates
    expect(updatedUserA?.stats.gamesPlayed).toBe(2);
    expect(updatedUserA?.stats.wins).toBe(2);
    expect(updatedUserA?.stats.totalScore).toBe(400); // 150 + 250
    expect(updatedUserA?.stats.correctGuesses).toBe(5); // 2 + 3
    expect(updatedUserA?.stats.drawingTurns).toBe(2); // 1 + 1
    expect(updatedUserA?.stats.highestScore).toBe(250); // max(150, 250)
    expect(updatedUserA?.stats.winRate).toBe(100);
  });

  it('2. Simultaneous finalization of the exact same match applies statistics ONLY ONCE (idempotency)', async () => {
    const userBId = testUserB._id.toString();

    const identicalParams = {
      gameId: 'test-game-idempotent-match',
      roomCode: 'ROOM3',
      rounds: 2,
      category: 'nature',
      players: [
        {
          userId: userBId,
          username: testUserB.username,
          displayName: testUserB.displayName,
          avatar: 'avatar-1',
          score: 120,
          rank: 1,
          correctGuesses: 2,
          drawingTurns: 1,
        },
      ],
      winner: {
        userId: userBId,
        displayName: testUserB.displayName,
        score: 120,
      },
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
    };

    // Run 3 concurrent calls with the exact same gameId
    const [res1, res2, res3] = await Promise.all([
      MatchHistoryService.finalizeMatch(identicalParams),
      MatchHistoryService.finalizeMatch(identicalParams),
      MatchHistoryService.finalizeMatch(identicalParams),
    ]);

    expect(res1.gameId).toBe('test-game-idempotent-match');
    expect(res2.gameId).toBe('test-game-idempotent-match');
    expect(res3.gameId).toBe('test-game-idempotent-match');

    const updatedUserB = await User.findById(userBId);
    // User B stats must only be counted ONCE, not three times
    expect(updatedUserB?.stats.gamesPlayed).toBe(1);
    expect(updatedUserB?.stats.wins).toBe(1);
    expect(updatedUserB?.stats.totalScore).toBe(120);
    expect(updatedUserB?.stats.correctGuesses).toBe(2);
  });

  it('3. Loss resets currentStreak to 0 while preserving bestStreak', async () => {
    const userAId = testUserA._id.toString();

    // User A currently has streak of 2 from test 1.
    // Now User A loses match 3:
    await MatchHistoryService.finalizeMatch({
      gameId: 'test-game-loss-streak',
      roomCode: 'ROOM4',
      rounds: 3,
      category: 'movies',
      players: [
        {
          userId: userAId,
          username: testUserA.username,
          displayName: testUserA.displayName,
          avatar: 'avatar-1',
          score: 50,
          rank: 2, // Lost
          correctGuesses: 1,
          drawingTurns: 1,
        },
      ],
      winner: {
        userId: 'other-user',
        displayName: 'Other Winner',
        score: 180,
      },
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
    });

    const userAfterLoss = await User.findById(userAId);
    expect(userAfterLoss?.stats.gamesPlayed).toBe(3);
    expect(userAfterLoss?.stats.wins).toBe(2);
    expect(userAfterLoss?.stats.losses).toBe(1);
    expect(userAfterLoss?.stats.currentStreak).toBe(0); // Reset to 0
    expect(userAfterLoss?.stats.bestStreak).toBe(2); // Preserved
    expect(userAfterLoss?.stats.winRate).toBe(66.7); // 2/3 = 66.7%
  });

  it('4. Cancelled match records match result without modifying player statistics', async () => {
    const userBId = testUserB._id.toString();
    const statsBefore = (await User.findById(userBId))?.stats;

    await MatchHistoryService.recordCancelledMatch(
      'test-game-cancelled-1',
      'ROOM5',
      3,
      [
        {
          userId: userBId,
          username: testUserB.username,
          displayName: testUserB.displayName,
          avatar: 'avatar-1',
          score: 30,
          rank: 1,
          correctGuesses: 0,
          drawingTurns: 0,
        },
      ]
    );

    const matchRec = await MatchResult.findOne({ gameId: 'test-game-cancelled-1' });
    expect(matchRec).toBeDefined();
    expect(matchRec?.status).toBe('cancelled');

    const statsAfter = (await User.findById(userBId))?.stats;
    expect(statsAfter?.gamesPlayed).toBe(statsBefore?.gamesPlayed);
    expect(statsAfter?.wins).toBe(statsBefore?.wins);
    expect(statsAfter?.totalScore).toBe(statsBefore?.totalScore);
  });

  it('5. Match finalization does not overwrite unrelated profile fields', async () => {
    const userAId = testUserA._id.toString();

    // User updates their bio in profile settings
    await User.updateOne({ _id: userAId }, { $set: { bio: 'Updated Custom Bio 2026' } });

    // Match finalization runs
    await MatchHistoryService.finalizeMatch({
      gameId: 'test-game-unrelated-fields',
      roomCode: 'ROOM6',
      rounds: 1,
      category: 'general',
      players: [
        {
          userId: userAId,
          username: testUserA.username,
          displayName: testUserA.displayName,
          avatar: 'avatar-1',
          score: 100,
          rank: 1,
          correctGuesses: 1,
          drawingTurns: 1,
        },
      ],
      winner: {
        userId: userAId,
        displayName: testUserA.displayName,
        score: 100,
      },
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
    });

    const userAfterMatch = await User.findById(userAId);
    // Bio must remain 'Updated Custom Bio 2026' and not be overwritten!
    expect(userAfterMatch?.bio).toBe('Updated Custom Bio 2026');
  });

  it('6. Partial-failure recovery: interrupted finalization recovers safely on retry without duplicate statistics', async () => {
    const userAId = testUserA._id.toString();
    const userBId = testUserB._id.toString();

    const userABefore = (await User.findById(userAId))?.stats;
    const userBBefore = (await User.findById(userBId))?.stats;

    const partialFailureGameId = 'test-game-partial-recovery';
    const matchParams = {
      gameId: partialFailureGameId,
      roomCode: 'RECOVER_ROOM',
      rounds: 2,
      category: 'science',
      players: [
        {
          userId: userAId,
          username: testUserA.username,
          displayName: testUserA.displayName,
          avatar: 'avatar-1',
          score: 80,
          rank: 1,
          correctGuesses: 2,
          drawingTurns: 1,
        },
        {
          userId: userBId,
          username: testUserB.username,
          displayName: testUserB.displayName,
          avatar: 'avatar-2',
          score: 40,
          rank: 2,
          correctGuesses: 1,
          drawingTurns: 1,
        },
      ],
      winner: {
        userId: userAId,
        displayName: testUserA.displayName,
        score: 80,
      },
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
    };

    // Step 1: Simulate partial failure where MatchResult was created and User A was applied,
    // but the system crashed before User B was updated.
    const partialMatch = await MatchResult.create({
      ...matchParams,
      status: 'completed',
      statsApplied: false,
      appliedPlayerIds: [userAId], // User A was recorded before crash
    });

    // Apply User A stats as would have happened before the crash
    await User.findByIdAndUpdate(userAId, {
      $inc: {
        'stats.gamesPlayed': 1,
        'stats.wins': 1,
        'stats.totalScore': 80,
      },
    });

    // Verify state at crash point: User A updated, User B not updated, statsApplied is false
    const matchAtCrash = await MatchResult.findOne({ gameId: partialFailureGameId });
    expect(matchAtCrash?.statsApplied).toBe(false);
    expect(matchAtCrash?.appliedPlayerIds).toEqual([userAId]);

    // Step 2: Retry finalization
    const recoveredMatch = await MatchHistoryService.finalizeMatch(matchParams);
    expect(recoveredMatch).toBeDefined();

    // Verify MatchResult now has statsApplied: true and both players in appliedPlayerIds
    const finalMatch = await MatchResult.findOne({ gameId: partialFailureGameId });
    expect(finalMatch?.statsApplied).toBe(true);
    expect(finalMatch?.appliedPlayerIds).toContain(userAId);
    expect(finalMatch?.appliedPlayerIds).toContain(userBId);

    // Verify User A was NOT updated a second time (gamesPlayed increased by 1 total, not 2)
    const userAAfter = await User.findById(userAId);
    expect(userAAfter?.stats.gamesPlayed).toBe((userABefore?.gamesPlayed || 0) + 1);
    expect(userAAfter?.stats.totalScore).toBe((userABefore?.totalScore || 0) + 80);

    // Verify User B WAS updated on recovery
    const userBAfter = await User.findById(userBId);
    expect(userBAfter?.stats.gamesPlayed).toBe((userBBefore?.gamesPlayed || 0) + 1);
    expect(userBAfter?.stats.totalScore).toBe((userBBefore?.totalScore || 0) + 40);
  });
});
