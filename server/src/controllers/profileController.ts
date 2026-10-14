import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Friendship } from '../models/Friendship.js';
import { MatchResult } from '../models/MatchResult.js';
import { UserAchievement } from '../models/UserAchievement.js';
import { MatchHistoryService } from '../services/MatchHistoryService.js';
import { verifyAccessToken } from '../utils/jwt.js';

export async function getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  res.status(200).json({
    success: true,
    user: req.user.toSafeObject(),
  });
}

export async function updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const { displayName, bio, avatar, preferredLanguage, theme, isOnboarded } = req.body;

  if (displayName !== undefined) {
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      res.status(400).json({
        success: false,
        error: 'Display name must be between 2 and 50 characters.',
      });
      return;
    }
    user.displayName = trimmedName;
  }

  if (bio !== undefined) {
    const trimmedBio = bio.trim();
    if (trimmedBio.length > 250) {
      res.status(400).json({
        success: false,
        error: 'Bio must not exceed 250 characters.',
      });
      return;
    }
    user.bio = trimmedBio;
  }

  if (avatar !== undefined) {
    user.avatar = avatar;
  }

  if (preferredLanguage !== undefined) {
    user.preferredLanguage = preferredLanguage;
  }

  if (theme !== undefined && ['light', 'dark', 'system'].includes(theme)) {
    user.theme = theme;
  }

  if (isOnboarded !== undefined) {
    user.isOnboarded = Boolean(isOnboarded);
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully.',
    user: user.toSafeObject(),
  });
}

export async function updateUsername(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const { username } = req.body;
  if (!username) {
    res.status(400).json({ success: false, error: 'Username is required.' });
    return;
  }

  const cleanUsername = username.trim();
  const normalized = cleanUsername.toLowerCase();

  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (!usernameRegex.test(cleanUsername)) {
    res.status(400).json({
      success: false,
      error: 'Username must be 3-30 characters long and can contain only letters, numbers, and underscores.',
    });
    return;
  }

  if (normalized === user.normalizedUsername) {
    res.status(200).json({
      success: true,
      message: 'Username unchanged.',
      user: user.toSafeObject(),
    });
    return;
  }

  const existing = await User.findOne({
    normalizedUsername: normalized,
    _id: { $ne: user._id },
  });

  if (existing) {
    res.status(409).json({
      success: false,
      error: 'This username is already taken. Please pick another.',
    });
    return;
  }

  try {
    user.username = cleanUsername;
    user.normalizedUsername = normalized;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Username successfully updated.',
      user: user.toSafeObject(),
    });
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({
        success: false,
        error: 'This username is already claimed by another player.',
      });
      return;
    }
    throw err;
  }
}

export async function checkUsername(req: Request, res: Response): Promise<void> {
  const username = (req.query.username as string || '').trim().toLowerCase();

  if (!username || username.length < 3 || username.length > 30) {
    res.status(400).json({
      success: false,
      available: false,
      error: 'Username must be between 3 and 30 characters.',
    });
    return;
  }

  const existing = await User.findOne({ normalizedUsername: username });

  res.status(200).json({
    success: true,
    available: !existing,
    message: existing ? 'Username is unavailable.' : 'Username is available!',
  });
}

export async function getPublicProfile(req: Request, res: Response): Promise<void> {
  const requestedUsername = (req.params.username || '').toLowerCase().trim();

  const user = await User.findOne({ normalizedUsername: requestedUsername });
  if (!user) {
    res.status(404).json({
      success: false,
      error: 'Player profile not found.',
    });
    return;
  }

  // Check privacy enforcement
  if (user.profileVisibility === 'private') {
    res.status(200).json({
      success: true,
      isPrivate: true,
      profile: {
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        isPrivate: true,
      },
    });
    return;
  }

  if (user.profileVisibility === 'friends_only') {
    let requestingUserId: string | null = null;
    let authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const payload = verifyAccessToken(authHeader.split(' ')[1]);
      requestingUserId = payload?.userId || null;
    } else if (req.cookies && req.cookies.access_token) {
      const payload = verifyAccessToken(req.cookies.access_token);
      requestingUserId = payload?.userId || null;
    }

    let isFriend = false;
    if (requestingUserId && requestingUserId === user._id.toString()) {
      isFriend = true; // Viewing own profile
    } else if (requestingUserId) {
      const friendship = await Friendship.findOne({
        $or: [
          { requesterId: requestingUserId, recipientId: user._id.toString() },
          { requesterId: user._id.toString(), recipientId: requestingUserId },
        ],
        status: 'accepted',
      });
      isFriend = !!friendship;
    }

    if (!isFriend) {
      res.status(200).json({
        success: true,
        isPrivate: true,
        isFriendsOnly: true,
        profile: {
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          isPrivate: true,
          message: 'This profile is visible to friends only.',
        },
      });
      return;
    }
  }

  res.status(200).json({
    success: true,
    isPrivate: false,
    profile: {
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      stats: user.stats,
      createdAt: user.createdAt,
      isPrivate: false,
    },
  });
}

export async function getStatsSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  res.status(200).json({
    success: true,
    stats: user.stats,
  });
}

export async function rebuildStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const updatedStats = await MatchHistoryService.rebuildUserStats(userId);
  res.status(200).json({
    success: true,
    message: 'User statistics rebuilt successfully.',
    stats: updatedStats,
  });
}

export async function exportUserData(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  const userId = req.userId;
  if (!user || !userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const [matches, friendships, achievements] = await Promise.all([
    MatchResult.find({ 'players.userId': userId }).sort({ completedAt: -1 }),
    Friendship.find({
      $or: [{ requesterId: userId }, { recipientId: userId }],
    }),
    UserAchievement.find({ userId }),
  ]);

  const exportPayload = {
    user: {
      id: user._id.toString(),
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      theme: user.theme,
      preferredLanguage: user.preferredLanguage,
      notificationPreferences: user.notificationPreferences,
      profileVisibility: user.profileVisibility,
      stats: user.stats,
      createdAt: user.createdAt,
    },
    matches: matches.map((m) => ({
      gameId: m.gameId,
      roomCode: m.roomCode,
      rounds: m.rounds,
      category: m.category,
      winner: m.winner,
      status: m.status,
      startedAt: m.startedAt,
      completedAt: m.completedAt,
      myResult: m.players.find((p) => p.userId === userId),
    })),
    friendships: friendships.map((f) => ({
      requesterId: f.requesterId,
      recipientId: f.recipientId,
      status: f.status,
      createdAt: f.createdAt,
      resolvedAt: f.resolvedAt,
    })),
    achievements: achievements.map((a) => ({
      achievementId: a.achievementId,
      unlockedAt: a.unlockedAt,
    })),
    exportedAt: new Date(),
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=drawmate-export-${user.username}.json`);
  res.status(200).json(exportPayload);
}
