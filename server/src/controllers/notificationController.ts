import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { NotificationService } from '../services/NotificationService.js';

export async function getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;

  try {
    const result = await NotificationService.getUserNotifications(userId, page, limit);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve notifications.' });
  }
}

export async function markNotificationRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const notificationId = req.params.id;

  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  if (!mongoose.isValidObjectId(notificationId)) {
    res.status(400).json({ success: false, error: 'Invalid notification ID format.' });
    return;
  }

  try {
    const success = await NotificationService.markAsRead(notificationId, userId);
    res.status(200).json({ success, message: success ? 'Notification marked as read.' : 'Notification not found.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update notification.' });
  }
}

export async function markAllNotificationsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  try {
    const count = await NotificationService.markAllAsRead(userId);
    res.status(200).json({ success: true, count, message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to mark all notifications as read.' });
  }
}
