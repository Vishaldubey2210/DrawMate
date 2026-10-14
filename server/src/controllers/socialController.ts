import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { SocialService } from '../services/SocialService.js';

export async function getFriends(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  try {
    const friends = await SocialService.getFriends(userId);
    res.status(200).json({ success: true, friends });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve friends.' });
  }
}

export async function getFriendRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  try {
    const requests = await SocialService.getPendingRequests(userId);
    res.status(200).json({ success: true, ...requests });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve friend requests.' });
  }
}

export async function sendFriendRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const { recipientId } = req.body;

  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  if (!recipientId) {
    res.status(400).json({ success: false, error: 'Recipient ID is required.' });
    return;
  }

  try {
    const result = await SocialService.sendFriendRequest(userId, recipientId);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to send friend request.' });
  }
}

export async function respondFriendRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const { requestId, action } = req.body;

  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  if (!requestId || !['accept', 'decline'].includes(action)) {
    res.status(400).json({ success: false, error: 'Invalid request ID or action.' });
    return;
  }

  try {
    const result = await SocialService.respondToFriendRequest(userId, requestId, action);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to respond to friend request.' });
  }
}

export async function cancelFriendRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const { requestId } = req.body;

  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  if (!requestId) {
    res.status(400).json({ success: false, error: 'Request ID is required.' });
    return;
  }

  try {
    const result = await SocialService.cancelFriendRequest(userId, requestId);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to cancel friend request.' });
  }
}

export async function removeFriend(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const targetUserId = req.params.id;

  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  try {
    const result = await SocialService.removeFriend(userId, targetUserId);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove friend.' });
  }
}

export async function blockUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const { targetUserId } = req.body;

  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  if (!targetUserId) {
    res.status(400).json({ success: false, error: 'Target user ID is required.' });
    return;
  }

  try {
    const result = await SocialService.blockUser(userId, targetUserId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to block user.' });
  }
}

export async function unblockUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const { targetUserId } = req.body;

  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  if (!targetUserId) {
    res.status(400).json({ success: false, error: 'Target user ID is required.' });
    return;
  }

  try {
    const result = await SocialService.unblockUser(userId, targetUserId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to unblock user.' });
  }
}

export async function inviteFriend(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const { friendId, roomCode } = req.body;

  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  if (!friendId || !roomCode) {
    res.status(400).json({ success: false, error: 'Friend ID and room code are required.' });
    return;
  }

  try {
    const result = await SocialService.inviteFriendToRoom(userId, friendId, roomCode);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to send room invite.' });
  }
}

export async function searchUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const query = (req.query.q as string) || '';
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;

  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  try {
    const result = await SocialService.searchUsers(query, userId, page, limit);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to search users.' });
  }
}
