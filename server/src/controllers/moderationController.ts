import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { ModerationService } from '../services/ModerationService.js';
import { User } from '../models/User.js';

export async function submitReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const { targetType, targetId, category, explanation } = req.body;

  if (!targetType || !targetId || !category || !explanation) {
    res.status(400).json({ success: false, error: 'All report fields are required.' });
    return;
  }

  try {
    const result = await ModerationService.createReport({
      reporterId: userId,
      targetType,
      targetId,
      category,
      explanation,
    });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to submit report.' });
  }
}

export async function reportDrawing(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const { targetUserId, roomCode, drawingData, explanation } = req.body;
  if (!targetUserId || !roomCode) {
    res.status(400).json({ success: false, error: 'Target user ID and room code are required.' });
    return;
  }

  try {
    const { AIModerationService } = await import('../services/AIModerationService.js');
    const result = await AIModerationService.moderateReportedDrawing({
      reporterId: userId,
      targetUserId,
      roomCode,
      drawingData,
      explanation: explanation || 'Inappropriate canvas sketch reported',
    });

    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to process drawing report.' });
  }
}

export async function getReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  const status = req.query.status as any;
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;

  try {
    const result = await ModerationService.getReports(status, page, limit);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve reports.' });
  }
}

export async function updateReportStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const moderatorId = req.userId;
  const reportId = req.params.id;
  const { status, moderatorNotes } = req.body;

  if (!moderatorId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  if (!status || !['open', 'under_review', 'resolved', 'dismissed'].includes(status)) {
    res.status(400).json({ success: false, error: 'Invalid report status.' });
    return;
  }

  try {
    const result = await ModerationService.updateReportStatus(
      reportId,
      status,
      moderatorId,
      moderatorNotes
    );

    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update report status.' });
  }
}

export async function performModerationAction(req: AuthenticatedRequest, res: Response): Promise<void> {
  const moderatorId = req.userId;
  const { action, targetUserId, roomCode, durationHours, reason } = req.body;

  if (!moderatorId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  try {
    let result: { success: boolean; message: string };

    switch (action) {
      case 'kick':
        if (!roomCode || !targetUserId) {
          res.status(400).json({ success: false, error: 'Room code and target user ID are required.' });
          return;
        }
        result = await ModerationService.kickPlayerFromRoom(
          moderatorId,
          roomCode,
          targetUserId,
          reason || 'Kicked by moderator'
        );
        break;

      case 'suspend':
        if (!targetUserId || !durationHours) {
          res.status(400).json({ success: false, error: 'Target user ID and duration in hours are required.' });
          return;
        }
        result = await ModerationService.suspendUser(
          moderatorId,
          targetUserId,
          Number(durationHours),
          reason || 'Suspended by moderator'
        );
        break;

      case 'ban':
        if (!targetUserId) {
          res.status(400).json({ success: false, error: 'Target user ID is required.' });
          return;
        }
        result = await ModerationService.banUser(
          moderatorId,
          targetUserId,
          reason || 'Banned by moderator'
        );
        break;

      case 'unban':
        if (!targetUserId) {
          res.status(400).json({ success: false, error: 'Target user ID is required.' });
          return;
        }
        result = await ModerationService.unbanUser(
          moderatorId,
          targetUserId,
          reason || 'Reinstated by moderator'
        );
        break;

      default:
        res.status(400).json({ success: false, error: 'Invalid moderation action specified.' });
        return;
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to execute moderation action.' });
  }
}

export async function getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 25;

  try {
    const result = await ModerationService.getAuditLogs(page, limit);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve audit logs.' });
  }
}

export async function getAdminUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const queryStr = (req.query.q as string) || '';
  const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);

  try {
    const filter: any = {};
    if (queryStr.trim()) {
      const escaped = queryStr.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { username: new RegExp(escaped, 'i') },
        { displayName: new RegExp(escaped, 'i') },
        { email: new RegExp(escaped, 'i') },
      ];
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve users.' });
  }
}
