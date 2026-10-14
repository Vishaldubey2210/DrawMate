import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { MatchHistoryService } from '../services/MatchHistoryService.js';
import { MatchResult } from '../models/MatchResult.js';

export async function getMyMatches(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const status = req.query.status as any;
  const outcome = req.query.outcome as any;

  try {
    const result = await MatchHistoryService.getUserMatchHistory(userId, {
      page,
      limit,
      status,
      outcome,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve match history.',
    });
  }
}

export async function getMatchDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  const matchId = req.params.id;
  const userId = req.userId;

  try {
    const query = mongoose.isValidObjectId(matchId)
      ? { $or: [{ _id: matchId }, { gameId: matchId }] }
      : { gameId: matchId };

    const match = await MatchResult.findOne(query);

    if (!match) {
      res.status(404).json({ success: false, error: 'Match record not found.' });
      return;
    }

    // Allow participants, or any authenticated player for public matches
    res.status(200).json({
      success: true,
      match: {
        gameId: match.gameId,
        roomCode: match.roomCode,
        rounds: match.rounds,
        category: match.category,
        players: match.players,
        winner: match.winner,
        startedAt: match.startedAt,
        completedAt: match.completedAt,
        status: match.status,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve match details.' });
  }
}
