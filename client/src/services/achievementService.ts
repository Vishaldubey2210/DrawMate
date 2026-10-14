import { api } from './api.js';
import { AchievementItem } from '../types/index.js';

export async function getMyAchievements(): Promise<{
  achievements: AchievementItem[];
  unlockedCount: number;
  totalCount: number;
}> {
  const res = await api.get('/achievements/my');
  return res.data;
}
