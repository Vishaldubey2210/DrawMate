import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { ReplayRecorderService } from '../services/ReplayRecorderService.js';
import { DrawingReplay } from '../models/DrawingReplay.js';

/**
 * Retrieves a round drawing replay by gameId and roundNumber
 */
export async function getRoundReplay(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { gameId, roundNumber } = req.params;
    const roundNum = parseInt(roundNumber, 10);

    if (!gameId || isNaN(roundNum)) {
      res.status(400).json({ success: false, error: 'Valid gameId and roundNumber are required.' });
      return;
    }

    const { replay, error } = await ReplayRecorderService.getInstance().getReplay(gameId, roundNum);

    if (error) {
      if (error.includes('confidential') || error.includes('forbidden')) {
        res.status(403).json({ success: false, error });
        return;
      }
      res.status(404).json({ success: false, error });
      return;
    }

    res.json({
      success: true,
      replay,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve round replay.' });
  }
}

/**
 * Retrieves summary metadata for all completed round replays in a match
 */
export async function getMatchReplayList(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { gameId } = req.params;

    if (!gameId) {
      res.status(400).json({ success: false, error: 'gameId parameter is required.' });
      return;
    }

    const replays = await DrawingReplay.find({ gameId })
      .select('gameId roomCode roundNumber drawerDisplayName secretWord category language durationMs createdAt')
      .sort({ roundNumber: 1 });

    res.json({
      success: true,
      replays,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve match replays.' });
  }
}
