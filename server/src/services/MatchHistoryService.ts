import { MatchResult, IMatchResult, IMatchPlayer } from '../models/MatchResult.js';
import { User } from '../models/User.js';
import { AchievementService } from './AchievementService.js';
import { NotificationService } from './NotificationService.js';
import { operationalMetrics } from './OperationalMetrics.js';
import { telemetryService } from './TelemetryService.js';

export interface FinalizeMatchParams {
  gameId: string;
  roomCode: string;
  rounds: number;
  category: string;
  players: IMatchPlayer[];
  winner: {
    userId: string;
    displayName: string;
    score: number;
  };
  startedAt: Date;
  completedAt: Date;
}

export class MatchHistoryService {
  /**
   * Finalizes a completed match authoritatively and idempotently, updating stats and achievements
   */
  public static async finalizeMatch(params: FinalizeMatchParams): Promise<IMatchResult> {
    // 1. Concurrency-safe match result persistence with duplicate-key protection
    let match: IMatchResult;
    try {
      match = await MatchResult.create({
        gameId: params.gameId,
        roomCode: params.roomCode,
        rounds: params.rounds,
        category: params.category || 'general',
        players: params.players,
        winner: params.winner,
        startedAt: params.startedAt,
        completedAt: params.completedAt,
        status: 'completed',
        statsApplied: false,
      });
    } catch (err: any) {
      if (err.code === 11000 || err.name === 'MongoServerError') {
        const existing = await MatchResult.findOne({ gameId: params.gameId });
        if (existing) {
          if (existing.statsApplied) {
            return existing;
          }
          match = existing;
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    operationalMetrics.recordMatchCompleted();
    telemetryService.trackEvent({
      eventName: 'match_completed',
      gameId: params.gameId,
      properties: {
        roomCode: params.roomCode,
        rounds: params.rounds,
        category: params.category,
        playerCount: params.players.length,
      },
    });

    // 2. Atomically update player statistics with crash-proof, single-document idempotency.
    // Each user's stats mutation AND gameId registration occur in a single atomic MongoDB write.
    // This eliminates any vulnerability to process termination between claiming and writing.
    const eligiblePlayers = params.players.filter((p) => Boolean(p.userId));

    for (const player of eligiblePlayers) {
      if (match.appliedPlayerIds && match.appliedPlayerIds.includes(player.userId)) {
        continue;
      }

      try {
        const isWinner = player.rank === 1;

        // Atomic check-and-update directly on the User model
        const updateDoc: any = {
          $inc: {
            'stats.gamesPlayed': 1,
            ...(isWinner
              ? { 'stats.wins': 1, 'stats.currentStreak': 1 }
              : { 'stats.losses': 1 }),
            'stats.totalScore': player.score || 0,
            'stats.correctGuesses': player.correctGuesses || 0,
            'stats.drawingTurns': player.drawingTurns || 0,
          },
          $max: {
            'stats.highestScore': player.score || 0,
          },
          $push: {
            processedMatchIds: { $each: [params.gameId], $slice: -100 },
          },
        };

        if (!isWinner) {
          updateDoc.$set = {
            'stats.currentStreak': 0,
          };
        }

        // Only update if this specific match hasn't been applied to this user yet
        let updatedUser = await User.findOneAndUpdate(
          {
            _id: player.userId,
            processedMatchIds: { $ne: params.gameId },
          },
          updateDoc,
          { new: true }
        );

        let wasAlreadyApplied = false;
        if (!updatedUser) {
          // If update returned null, check if user already has gameId in processedMatchIds
          const existingUser = await User.findOne({
            _id: player.userId,
            processedMatchIds: params.gameId,
          });
          if (existingUser) {
            wasAlreadyApplied = true;
            updatedUser = existingUser;
          }
        }

        if (updatedUser) {
          if (!wasAlreadyApplied) {
            // Recalculate streak & winRate if stats were just mutated
            if (isWinner && updatedUser.stats && updatedUser.stats.currentStreak > (updatedUser.stats.bestStreak || 0)) {
              await User.updateOne(
                { _id: player.userId, 'stats.bestStreak': { $lt: updatedUser.stats.currentStreak } },
                { $set: { 'stats.bestStreak': updatedUser.stats.currentStreak } }
              );
              updatedUser.stats.bestStreak = updatedUser.stats.currentStreak;
            }

            if (updatedUser.stats && updatedUser.stats.gamesPlayed > 0) {
              const winRate = Number(((updatedUser.stats.wins / updatedUser.stats.gamesPlayed) * 100).toFixed(1));
              await User.updateOne(
                { _id: player.userId },
                { $set: { 'stats.winRate': winRate } }
              );
            }

            // Dispatch match completion notification
            await NotificationService.createNotification({
              recipientId: player.userId,
              type: 'match_complete',
              title: isWinner ? 'Victory!' : 'Match Completed',
              message: isWinner
                ? `You won the match in room ${params.roomCode} with ${player.score} points!`
                : `You finished rank #${player.rank} with ${player.score} points.`,
              data: {
                gameId: params.gameId,
                roomCode: params.roomCode,
                rank: player.rank,
                score: player.score,
              },
            });
          }

          // Safely record player in match document's appliedPlayerIds
          await MatchResult.updateOne(
            { _id: match._id },
            { $addToSet: { appliedPlayerIds: player.userId } }
          );
        }
      } catch (err) {
        console.error(`Error updating stats for player ${player.userId}:`, err);
      }
    }

    // 3. Mark statsApplied = true ONLY after all eligible players have been recorded
    const finalMatchDoc = await MatchResult.findById(match._id);
    const allApplied = eligiblePlayers.every((p) => finalMatchDoc?.appliedPlayerIds?.includes(p.userId));
    if (allApplied) {
      await MatchResult.updateOne(
        { _id: match._id },
        { $set: { statsApplied: true } }
      );
    }

    // Evaluate progression achievements
    try {
      await AchievementService.evaluatePostMatch(
        params.players.map((p) => ({
          userId: p.userId,
          rank: p.rank,
          score: p.score,
          correctGuesses: p.correctGuesses,
        }))
      );
    } catch (err) {
      console.error('Error in post-match achievement evaluation:', err);
    }

    return match;
  }

  /**
   * Persists a cancelled match without awarding false wins or skewing win-rate
   */
  public static async recordCancelledMatch(
    gameId: string,
    roomCode: string,
    rounds: number,
    players: IMatchPlayer[]
  ): Promise<IMatchResult | null> {
    try {
      const cancelled = await MatchResult.create({
        gameId,
        roomCode,
        rounds,
        category: 'general',
        players,
        winner: {
          userId: 'none',
          displayName: 'None (Cancelled)',
          score: 0,
        },
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
        status: 'cancelled',
        statsApplied: true,
      });

      operationalMetrics.recordMatchCancelled();
      telemetryService.trackEvent({
        eventName: 'match_cancelled',
        gameId,
        properties: {
          roomCode,
          rounds,
          playerCount: players.length,
        },
      });

      return cancelled;
    } catch (err: any) {
      if (err.code === 11000 || err.name === 'MongoServerError') {
        return await MatchResult.findOne({ gameId });
      }
      throw err;
    }
  }

  /**
   * Retrieves paginated match history for a specific user with filters
   */
  public static async getUserMatchHistory(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      status?: 'all' | 'completed' | 'cancelled';
      outcome?: 'all' | 'win' | 'loss';
    } = {}
  ): Promise<{
    matches: IMatchResult[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 10, 50);
    const skip = (page - 1) * limit;

    const query: any = {
      'players.userId': userId,
    };

    if (options.status && options.status !== 'all') {
      query.status = options.status;
    }

    if (options.outcome === 'win') {
      query['winner.userId'] = userId;
      query.status = 'completed';
    } else if (options.outcome === 'loss') {
      query['winner.userId'] = { $ne: userId };
      query.status = 'completed';
    }

    const [matches, total] = await Promise.all([
      MatchResult.find(query)
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit),
      MatchResult.countDocuments(query),
    ]);

    return {
      matches,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Rebuilds a user's aggregates from canonical completed matches
   */
  public static async rebuildUserStats(userId: string): Promise<UserStats | null> {
    const user = await User.findById(userId);
    if (!user) return null;

    const matches = await MatchResult.find({
      'players.userId': userId,
      status: 'completed',
    }).sort({ completedAt: 1 });

    let gamesPlayed = 0;
    let wins = 0;
    let losses = 0;
    let totalScore = 0;
    let highestScore = 0;
    let correctGuesses = 0;
    let drawingTurns = 0;
    let currentStreak = 0;
    let bestStreak = 0;

    for (const match of matches) {
      gamesPlayed += 1;
      const player = match.players.find((p) => p.userId === userId);
      if (!player) continue;

      totalScore += player.score || 0;
      highestScore = Math.max(highestScore, player.score || 0);
      correctGuesses += player.correctGuesses || 0;
      drawingTurns += player.drawingTurns || 0;

      if (match.winner.userId === userId || player.rank === 1) {
        wins += 1;
        currentStreak += 1;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        losses += 1;
        currentStreak = 0;
      }
    }

    const winRate = gamesPlayed > 0 ? Number(((wins / gamesPlayed) * 100).toFixed(1)) : 0;

    user.stats = {
      gamesPlayed,
      wins,
      losses,
      draws: 0,
      winRate,
      totalScore,
      highestScore,
      correctGuesses,
      drawingTurns,
      currentStreak,
      bestStreak,
    };

    await user.save();
    return user.stats;
  }
}

type UserStats = typeof User.prototype.stats;
