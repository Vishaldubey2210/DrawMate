import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Session } from '../models/Session.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { ENV } from '../config/env.js';

const isProd = ENV.NODE_ENV === 'production';
const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
};

export async function getSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  res.status(200).json({
    success: true,
    settings: {
      theme: user.theme,
      preferredLanguage: user.preferredLanguage,
      notificationPreferences: user.notificationPreferences,
      profileVisibility: user.profileVisibility,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    },
  });
}

export async function updatePreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const { theme, preferredLanguage } = req.body;

  if (theme && ['light', 'dark', 'system'].includes(theme)) {
    user.theme = theme;
  }

  if (preferredLanguage) {
    user.preferredLanguage = preferredLanguage;
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Preferences saved.',
    user: user.toSafeObject(),
  });
}

export async function updateNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const { productUpdates, gameInvites, emailNotifications } = req.body;

  user.notificationPreferences = {
    productUpdates: productUpdates ?? user.notificationPreferences.productUpdates,
    gameInvites: gameInvites ?? user.notificationPreferences.gameInvites,
    emailNotifications: emailNotifications ?? user.notificationPreferences.emailNotifications,
  };

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Notification preferences updated.',
    notificationPreferences: user.notificationPreferences,
  });
}

export async function updatePrivacy(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const { profileVisibility } = req.body;

  if (!['public', 'friends_only', 'private'].includes(profileVisibility)) {
    res.status(400).json({
      success: false,
      error: 'Profile visibility must be "public", "friends_only", or "private".',
    });
    return;
  }

  user.profileVisibility = profileVisibility;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Privacy settings updated.',
    profileVisibility: user.profileVisibility,
  });
}

export async function changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({
      success: false,
      error: 'Both current password and new password are required.',
    });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({
      success: false,
      error: 'New password must be at least 8 characters long.',
    });
    return;
  }

  const isValid = await comparePassword(currentPassword, user.passwordHash);
  if (!isValid) {
    res.status(400).json({
      success: false,
      error: 'Current password provided is incorrect.',
    });
    return;
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  // Invalidate other sessions
  await Session.updateMany({ userId: user._id }, { revoked: true });

  res.status(200).json({
    success: true,
    message: 'Your password has been changed successfully.',
  });
}

export async function deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const { password, confirmationPhrase } = req.body;

  if (confirmationPhrase !== 'delete my account') {
    res.status(400).json({
      success: false,
      error: 'Please type "delete my account" exactly to confirm account deletion.',
    });
    return;
  }

  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    res.status(400).json({
      success: false,
      error: 'Incorrect password. Account deletion aborted.',
    });
    return;
  }

  const userId = user._id;

  // Clean up all associated sessions and reset tokens
  await Session.deleteMany({ userId });
  await PasswordResetToken.deleteMany({ userId });
  await user.deleteOne();

  res.clearCookie('access_token', COOKIE_BASE_OPTIONS);
  res.clearCookie('refresh_token', COOKIE_BASE_OPTIONS);

  res.status(200).json({
    success: true,
    message: 'Your account and personal data have been permanently removed.',
  });
}
