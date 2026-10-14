import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AchievementService } from '../services/AchievementService.js';

export async function getMyAchievements(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  try {
    const achievements = await AchievementService.getUserAchievements(userId);
    const unlockedCount = achievements.filter((a) => a.unlocked).length;

    res.status(200).json({
      success: true,
      achievements,
      unlockedCount,
      totalCount: achievements.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve achievements.' });
  }
}
