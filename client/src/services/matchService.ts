import { api } from './api.js';
import { MatchResultRecord } from '../types/index.js';

export async function getMyMatches(options: {
  page?: number;
  limit?: number;
  status?: string;
  outcome?: string;
} = {}): Promise<{
  matches: MatchResultRecord[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const res = await api.get('/matches/my', { params: options });
  return res.data;
}

export async function getMatchDetails(id: string): Promise<MatchResultRecord> {
  const res = await api.get(`/matches/${id}`);
  return res.data.match;
}
