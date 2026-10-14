import { Request, Response } from 'express';
import { LeaderboardService, LeaderboardCategory } from '../services/LeaderboardService.js';
import { verifyAccessToken } from '../utils/jwt.js';

export async function getLeaderboard(req: Request, res: Response): Promise<void> {
  const category = (req.query.category as LeaderboardCategory) || 'score';
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 25;

  let requestingUserId: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const payload = verifyAccessToken(authHeader.split(' ')[1]);
    requestingUserId = payload?.userId;
  } else if (req.cookies && req.cookies.access_token) {
    const payload = verifyAccessToken(req.cookies.access_token);
    requestingUserId = payload?.userId;
  }

  try {
    const result = await LeaderboardService.getLeaderboard(category, page, limit, requestingUserId);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve leaderboard rankings.' });
  }
}
