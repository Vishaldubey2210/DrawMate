import { User } from '../models/User.js';

export type LeaderboardCategory = 'score' | 'wins' | 'winRate';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  value: number;
  gamesPlayed: number;
  wins: number;
  totalScore: number;
  winRate: number;
}

export class LeaderboardService {
  /**
   * Retrieves paginated leaderboard rankings with tie-handling and requesting user rank
   */
  public static async getLeaderboard(
    category: LeaderboardCategory = 'score',
    page: number = 1,
    limit: number = 25,
    currentUserId?: string
  ): Promise<{
    entries: LeaderboardEntry[];
    total: number;
    page: number;
    totalPages: number;
    currentUserRank?: LeaderboardEntry | null;
  }> {
    const validLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (page - 1) * validLimit;

    let sortCriteria: any = { 'stats.totalScore': -1, createdAt: 1 };
    let filterCriteria: any = { status: 'active' };

    if (category === 'wins') {
      sortCriteria = { 'stats.wins': -1, 'stats.totalScore': -1, createdAt: 1 };
    } else if (category === 'winRate') {
      // Must have played at least 3 games to qualify for win rate leaderboard
      filterCriteria = { status: 'active', 'stats.gamesPlayed': { $gte: 3 } };
      sortCriteria = { 'stats.winRate': -1, 'stats.wins': -1, 'stats.totalScore': -1, createdAt: 1 };
    }

    const [users, total] = await Promise.all([
      User.find(filterCriteria).sort(sortCriteria).skip(skip).limit(validLimit),
      User.countDocuments(filterCriteria),
    ]);

    const entries: LeaderboardEntry[] = users.map((u, idx) => {
      let value = u.stats.totalScore || 0;
      if (category === 'wins') value = u.stats.wins || 0;
      if (category === 'winRate') value = u.stats.winRate || 0;

      return {
        rank: skip + idx + 1,
        userId: u._id.toString(),
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
        value,
        gamesPlayed: u.stats.gamesPlayed || 0,
        wins: u.stats.wins || 0,
        totalScore: u.stats.totalScore || 0,
        winRate: u.stats.winRate || 0,
      };
    });

    let currentUserRank: LeaderboardEntry | null = null;

    if (currentUserId) {
      const user = await User.findById(currentUserId);
      if (user && user.status === 'active') {
        let value = user.stats.totalScore || 0;
        if (category === 'wins') value = user.stats.wins || 0;
        if (category === 'winRate') value = user.stats.winRate || 0;

        // Check if user is already in current entries page
        const found = entries.find((e) => e.userId === currentUserId);
        if (found) {
          currentUserRank = found;
        } else {
          // Calculate user's overall rank position
          let higherCountQuery: any = { status: 'active' };
          if (category === 'score') {
            higherCountQuery['stats.totalScore'] = { $gt: user.stats.totalScore || 0 };
          } else if (category === 'wins') {
            higherCountQuery['stats.wins'] = { $gt: user.stats.wins || 0 };
          } else if (category === 'winRate') {
            higherCountQuery['stats.gamesPlayed'] = { $gte: 3 };
            higherCountQuery['stats.winRate'] = { $gt: user.stats.winRate || 0 };
          }

          const rankCount = await User.countDocuments(higherCountQuery);

          currentUserRank = {
            rank: rankCount + 1,
            userId: user._id.toString(),
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            value,
            gamesPlayed: user.stats.gamesPlayed || 0,
            wins: user.stats.wins || 0,
            totalScore: user.stats.totalScore || 0,
            winRate: user.stats.winRate || 0,
          };
        }
      }
    }

    return {
      entries,
      total,
      page,
      totalPages: Math.ceil(total / validLimit) || 1,
      currentUserRank,
    };
  }
}
