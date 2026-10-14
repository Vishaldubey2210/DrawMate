import { api } from './api.js';
import { LeaderboardEntry } from '../types/index.js';

export async function getLeaderboard(
  category: 'score' | 'wins' | 'winRate' = 'score',
  page = 1,
  limit = 25
): Promise<{
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  totalPages: number;
  currentUserRank?: LeaderboardEntry | null;
}> {
  const res = await api.get('/leaderboard', { params: { category, page, limit } });
  return res.data;
}
