import { UserAchievement, IUserAchievement } from '../models/UserAchievement.js';
import { User } from '../models/User.js';
import { NotificationService } from './NotificationService.js';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: 'milestone' | 'victory' | 'skill';
  icon: string;
  target?: number;
}

export const ACHIEVEMENTS_CATALOG: AchievementDefinition[] = [
  {
    id: 'first_game',
    name: 'First Canvas',
    description: 'Complete your first multiplayer drawing match.',
    category: 'milestone',
    icon: 'palette',
    target: 1,
  },
  {
    id: 'first_win',
    name: 'Master Guesser',
    description: 'Claim 1st place in a multiplayer match.',
    category: 'victory',
    icon: 'trophy',
    target: 1,
  },
  {
    id: 'five_matches',
    name: 'Seasoned Doodler',
    description: 'Complete 5 multiplayer matches.',
    category: 'milestone',
    icon: 'flame',
    target: 5,
  },
  {
    id: 'ten_guesses',
    name: 'Sharp Instincts',
    description: 'Accumulate 10 correct word guesses.',
    category: 'skill',
    icon: 'target',
    target: 10,
  },
  {
    id: 'streak_3',
    name: 'Triple Threat',
    description: 'Achieve a winning streak of 3 consecutive matches.',
    category: 'victory',
    icon: 'zap',
    target: 3,
  },
  {
    id: 'high_scorer',
    name: 'High Roller',
    description: 'Score 1,500 or more points in a single match.',
    category: 'skill',
    icon: 'award',
    target: 1500,
  },
];

export class AchievementService {
  /**
   * Returns all available achievement definitions
   */
  public static getCatalog(): AchievementDefinition[] {
    return ACHIEVEMENTS_CATALOG;
  }

  /**
   * Returns achievements for a user along with unlock status and progress
   */
  public static async getUserAchievements(userId: string): Promise<
    Array<
      AchievementDefinition & {
        unlocked: boolean;
        unlockedAt?: Date;
        progress: number;
      }
    >
  > {
    const [user, unlockedRecords] = await Promise.all([
      User.findById(userId),
      UserAchievement.find({ userId }),
    ]);

    const unlockedMap = new Map<string, IUserAchievement>();
    unlockedRecords.forEach((record) => {
      unlockedMap.set(record.achievementId, record);
    });

    const stats = user?.stats || {
      gamesPlayed: 0,
      wins: 0,
      correctGuesses: 0,
      currentStreak: 0,
      highestScore: 0,
    };

    return ACHIEVEMENTS_CATALOG.map((def) => {
      const unlockedRecord = unlockedMap.get(def.id);
      let progress = 0;

      switch (def.id) {
        case 'first_game':
        case 'five_matches':
          progress = Math.min(stats.gamesPlayed, def.target || 1);
          break;
        case 'first_win':
          progress = Math.min(stats.wins, 1);
          break;
        case 'ten_guesses':
          progress = Math.min(stats.correctGuesses, def.target || 10);
          break;
        case 'streak_3':
          progress = Math.min(stats.currentStreak, def.target || 3);
          break;
        case 'high_scorer':
          progress = Math.min(stats.highestScore, def.target || 1500);
          break;
      }

      return {
        ...def,
        unlocked: !!unlockedRecord,
        unlockedAt: unlockedRecord?.unlockedAt,
        progress,
      };
    });
  }

  /**
   * Evaluates post-match stats for players and awards eligible achievements idempotently
   */
  public static async evaluatePostMatch(
    players: Array<{
      userId: string;
      rank: number;
      score: number;
      correctGuesses: number;
    }>
  ): Promise<void> {
    for (const player of players) {
      if (!player.userId) continue;

      const user = await User.findById(player.userId);
      if (!user) continue;

      const toAward: string[] = [];

      // Check first_game & five_matches
      if (user.stats.gamesPlayed >= 1) {
        toAward.push('first_game');
      }
      if (user.stats.gamesPlayed >= 5) {
        toAward.push('five_matches');
      }

      // Check first_win
      if (player.rank === 1 || user.stats.wins >= 1) {
        toAward.push('first_win');
      }

      // Check ten_guesses
      if (user.stats.correctGuesses >= 10) {
        toAward.push('ten_guesses');
      }

      // Check streak_3
      if (user.stats.currentStreak >= 3 || user.stats.bestStreak >= 3) {
        toAward.push('streak_3');
      }

      // Check high_scorer
      if (player.score >= 1500 || user.stats.highestScore >= 1500) {
        toAward.push('high_scorer');
      }

      // Award each achievement safely and create notification if newly unlocked
      for (const achId of toAward) {
        const existing = await UserAchievement.findOne({
          userId: user._id.toString(),
          achievementId: achId,
        });

        if (!existing) {
          try {
            await UserAchievement.create({
              userId: user._id.toString(),
              achievementId: achId,
              unlockedAt: new Date(),
            });

            const def = ACHIEVEMENTS_CATALOG.find((d) => d.id === achId);
            if (def) {
              await NotificationService.createNotification({
                recipientId: user._id.toString(),
                type: 'achievement_unlocked',
                title: 'Achievement Unlocked!',
                message: `You earned "${def.name}": ${def.description}`,
                data: { achievementId: achId, name: def.name },
              });
            }
          } catch (err: any) {
            // E11000 duplicate key error is completely benign due to race condition safeguard
            if (err.code !== 11000) {
              console.error(`Error unlocking achievement ${achId}:`, err);
            }
          }
        }
      }
    }
  }
}
