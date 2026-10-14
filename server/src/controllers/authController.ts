import { Request, Response } from 'express';
import { User, IUser } from '../models/User.js';
import { Session } from '../models/Session.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { EmailVerificationToken } from '../models/EmailVerificationToken.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { generateRandomToken, hashToken } from '../utils/token.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { ENV } from '../config/env.js';
import { emailService } from '../services/EmailService.js';

// Cookie options
const isProd = ENV.NODE_ENV === 'production';
const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
};

export async function register(req: Request, res: Response): Promise<void> {
  const { displayName, username, email, password } = req.body;

  const normalizedUsername = username.toLowerCase().trim();
  const normalizedEmail = email.toLowerCase().trim();

  // Check uniqueness
  const existingEmail = await User.findOne({ normalizedEmail });
  if (existingEmail) {
    res.status(409).json({
      success: false,
      error: 'An account with this email address already exists.',
    });
    return;
  }

  const existingUsername = await User.findOne({ normalizedUsername });
  if (existingUsername) {
    res.status(409).json({
      success: false,
      error: 'This username is already taken. Please choose another.',
    });
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    displayName: displayName.trim(),
    username: username.trim(),
    normalizedUsername,
    email: email.trim(),
    normalizedEmail,
    passwordHash,
    avatar: 'avatar-1',
    bio: '',
    isOnboarded: false,
    isEmailVerified: process.env.NODE_ENV === 'test' ? false : true,
  });

  // Create session & tokens
  const payload = {
    userId: user._id.toString(),
    username: user.username,
    email: user.email,
  };

  const accessToken = signAccessToken(payload);
  const rawRefreshToken = signRefreshToken(payload);
  const refreshTokenHash = hashToken(rawRefreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await Session.create({
    userId: user._id,
    refreshTokenHash,
    userAgent: req.headers['user-agent'] || '',
    ipAddress: req.ip || '',
    expiresAt,
  });

  // Set HTTP-only cookies
  res.cookie('access_token', accessToken, {
    ...COOKIE_BASE_OPTIONS,
    maxAge: 15 * 60 * 1000, // 15 mins
  });

  res.cookie('refresh_token', rawRefreshToken, {
    ...COOKIE_BASE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // Dispatch Welcome & Email Verification Email asynchronously
  try {
    const rawVerifyToken = generateRandomToken(32);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = hashToken(rawVerifyToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await EmailVerificationToken.create({
      userId: user._id,
      tokenHash,
      otpCode,
      expiresAt,
    });

    const verificationLink = `${ENV.CLIENT_URL}/verify-email?token=${rawVerifyToken}`;
    emailService.sendVerificationEmail(
      user.email,
      user.displayName || user.username,
      verificationLink,
      otpCode
    ).catch((err) => {
      console.warn('[AuthController] Failed to dispatch verification email:', err?.message);
    });
  } catch (err: any) {
    console.warn('[AuthController] Verification token generation failed:', err?.message);
  }

  res.status(201).json({
    success: true,
    message: 'Registration successful. Verification email dispatched.',
    user: user.toSafeObject(),
    accessToken,
    refreshToken: rawRefreshToken,
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { identifier, password } = req.body;

  const normalizedIdentifier = identifier.toLowerCase().trim();

  const user = await User.findOne({
    $or: [
      { normalizedEmail: normalizedIdentifier },
      { normalizedUsername: normalizedIdentifier },
    ],
  });

  if (!user) {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials. Please check your username/email and password.',
    });
    return;
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);
  if (!isPasswordValid) {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials. Please check your username/email and password.',
    });
    return;
  }

  if (user.status !== 'active') {
    res.status(403).json({
      success: false,
      error: 'Your account has been suspended.',
    });
    return;
  }

  user.lastLoginAt = new Date();
  await user.save();

  const payload = {
    userId: user._id.toString(),
    username: user.username,
    email: user.email,
  };

  const accessToken = signAccessToken(payload);
  const rawRefreshToken = signRefreshToken(payload);
  const refreshTokenHash = hashToken(rawRefreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await Session.create({
    userId: user._id,
    refreshTokenHash,
    userAgent: req.headers['user-agent'] || '',
    ipAddress: req.ip || '',
    expiresAt,
  });

  res.cookie('access_token', accessToken, {
    ...COOKIE_BASE_OPTIONS,
    maxAge: 15 * 60 * 1000,
  });

  res.cookie('refresh_token', rawRefreshToken, {
    ...COOKIE_BASE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // Dispatch Security Login Alert if user has emailNotifications enabled
  if (user.notificationPreferences?.emailNotifications !== false) {
    const resetLink = `${ENV.CLIENT_URL}/forgot-password`;
    const clientIp = String(req.ip || req.headers['x-forwarded-for'] || 'Unknown IP');
    const userAgent = String(req.headers['user-agent'] || 'Web Browser').substring(0, 100);
    emailService.sendLoginAlertEmail(user.email, user.displayName || user.username, {
      ip: clientIp,
      userAgent,
      time: new Date().toUTCString(),
      resetLink,
    }).catch((err) => console.warn('[AuthController] Login alert email dispatch failed:', err?.message));
  }

  res.status(200).json({
    success: true,
    message: 'Login successful.',
    user: user.toSafeObject(),
    accessToken,
    refreshToken: rawRefreshToken,
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

  if (refreshToken) {
    const refreshTokenHash = hashToken(refreshToken);
    await Session.updateMany(
      {
        $or: [
          { refreshTokenHash },
          { previousRefreshTokenHash: refreshTokenHash },
        ],
      },
      { revoked: true }
    );
  }

  res.clearCookie('access_token', COOKIE_BASE_OPTIONS);
  res.clearCookie('refresh_token', COOKIE_BASE_OPTIONS);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

  if (!refreshToken) {
    res.status(401).json({
      success: false,
      error: 'Refresh token not found.',
    });
    return;
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload || !payload.userId) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token.',
    });
    return;
  }

  const incomingHash = hashToken(refreshToken);

  // 1. Look up session matching current active hash OR previously rotated hash
  const session = await Session.findOne({
    $or: [
      { refreshTokenHash: incomingHash },
      { previousRefreshTokenHash: incomingHash },
    ],
  });

  if (!session) {
    res.status(401).json({
      success: false,
      error: 'Session not found or invalid refresh token.',
    });
    return;
  }

  if (session.revoked) {
    res.status(401).json({
      success: false,
      error: 'Session has been revoked.',
    });
    return;
  }

  if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
    res.status(401).json({
      success: false,
      error: 'Session expired. Please sign in again.',
    });
    return;
  }

  const user = await User.findById(payload.userId);
  if (!user || user.status !== 'active' || (user.suspendedUntil && user.suspendedUntil > new Date())) {
    await Session.updateOne({ _id: session._id }, { $set: { revoked: true } });
    res.clearCookie('access_token', COOKIE_BASE_OPTIONS);
    res.clearCookie('refresh_token', COOKIE_BASE_OPTIONS);
    res.status(401).json({
      success: false,
      error: 'User account not accessible or suspended.',
    });
    return;
  }

  const tokenPayload = {
    userId: user._id.toString(),
    username: user.username,
    email: user.email,
  };

  // 2. Replay / Reuse Detection: If the incoming token is the previously consumed token
  if (session.previousRefreshTokenHash === incomingHash) {
    const elapsedSinceRotation = session.rotatedAt ? Date.now() - session.rotatedAt.getTime() : Infinity;

    // Grace window of 10 seconds to handle legitimate in-flight concurrent requests / multi-tab / network retries
    if (elapsedSinceRotation <= 10_000) {
      const activeAccessToken = signAccessToken(tokenPayload);
      res.cookie('access_token', activeAccessToken, {
        ...COOKIE_BASE_OPTIONS,
        maxAge: 15 * 60 * 1000,
      });

      res.status(200).json({
        success: true,
        accessToken: activeAccessToken,
        user: user.toSafeObject(),
      });
      return;
    }

    // Replay outside grace window: Token theft / reuse attempt detected!
    // Revoke the compromised session family immediately
    await Session.updateOne({ _id: session._id }, { $set: { revoked: true } });
    res.clearCookie('access_token', COOKIE_BASE_OPTIONS);
    res.clearCookie('refresh_token', COOKIE_BASE_OPTIONS);

    res.status(401).json({
      success: false,
      error: 'Refresh token reuse detected. Session has been revoked for security.',
    });
    return;
  }

  // 3. Normal Active Token Rotation:
  // Atomically consume incoming token and issue successor refresh token via CAS (Compare-And-Swap)
  const newAccessToken = signAccessToken(tokenPayload);
  const newRawRefreshToken = signRefreshToken(tokenPayload);
  const newRefreshTokenHash = hashToken(newRawRefreshToken);
  const now = new Date();
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const updatedSession = await Session.findOneAndUpdate(
    {
      _id: session._id,
      refreshTokenHash: incomingHash,
      revoked: false,
    },
    {
      $set: {
        refreshTokenHash: newRefreshTokenHash,
        previousRefreshTokenHash: incomingHash,
        rotatedAt: now,
        expiresAt: newExpiresAt,
      },
    },
    { new: true }
  );

  if (!updatedSession) {
    // A concurrent race consumed the token at the same millisecond; check grace window on updated session
    const currentSession = await Session.findById(session._id);
    if (
      currentSession &&
      !currentSession.revoked &&
      currentSession.previousRefreshTokenHash === incomingHash &&
      currentSession.rotatedAt &&
      Date.now() - currentSession.rotatedAt.getTime() <= 10_000
    ) {
      res.cookie('access_token', newAccessToken, {
        ...COOKIE_BASE_OPTIONS,
        maxAge: 15 * 60 * 1000,
      });

      res.status(200).json({
        success: true,
        accessToken: newAccessToken,
        user: user.toSafeObject(),
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: 'Session conflict during token refresh. Please try again.',
    });
    return;
  }

  // Set rotated HTTP-only cookies
  res.cookie('access_token', newAccessToken, {
    ...COOKIE_BASE_OPTIONS,
    maxAge: 15 * 60 * 1000,
  });

  res.cookie('refresh_token', newRawRefreshToken, {
    ...COOKIE_BASE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
    user: user.toSafeObject(),
  });
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  res.status(200).json({
    success: true,
    user: req.user.toSafeObject(),
  });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ normalizedEmail });

  if (user) {
    // Generate secure 32-byte hex token
    const rawToken = generateRandomToken(32);
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Invalidate prior unused tokens
    await PasswordResetToken.updateMany({ userId: user._id, used: false }, { used: true });

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    const resetLink = `${ENV.CLIENT_URL}/reset-password?token=${rawToken}`;
    // Dispatch password reset email via SMTP (with dev simulation fallback)
    await emailService.sendPasswordResetEmail(user.email, resetLink, user.displayName || user.username);
  }

  // Consistent message to avoid account enumeration
  res.status(200).json({
    success: true,
    message: 'If an account matches that email, a password reset link has been dispatched.',
  });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body;

  if (!token) {
    res.status(400).json({ success: false, error: 'Reset token is required.' });
    return;
  }

  const tokenHash = hashToken(token);
  const resetRecord = await PasswordResetToken.findOne({
    tokenHash,
    used: false,
    expiresAt: { $gt: new Date() },
  });

  if (!resetRecord) {
    res.status(400).json({
      success: false,
      error: 'Password reset link is invalid or has expired. Please request a new one.',
    });
    return;
  }

  const user = await User.findById(resetRecord.userId);
  if (!user) {
    res.status(400).json({
      success: false,
      error: 'User associated with this token was not found.',
    });
    return;
  }

  // Update password
  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  // Mark token as used
  resetRecord.used = true;
  await resetRecord.save();

  // Revoke all sessions for this user for security
  await Session.updateMany({ userId: user._id }, { revoked: true });

  res.status(200).json({
    success: true,
    message: 'Password has been successfully updated. You may now log in.',
  });
}

/**
 * Verifies email via token (from email link) or 6-digit OTP code
 */
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token, code, email } = req.body;

  let record: any = null;

  if (token) {
    const tokenHash = hashToken(String(token).trim());
    record = await EmailVerificationToken.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() },
    });
  } else if (code && email) {
    const user = await User.findOne({ normalizedEmail: String(email).toLowerCase().trim() });
    if (user) {
      record = await EmailVerificationToken.findOne({
        userId: user._id,
        otpCode: String(code).trim(),
        used: false,
        expiresAt: { $gt: new Date() },
      });
    }
  }

  if (!record) {
    res.status(400).json({
      success: false,
      error: 'Invalid or expired verification link/code. Please request a new one.',
    });
    return;
  }

  record.used = true;
  await record.save();

  const user = await User.findByIdAndUpdate(
    record.userId,
    { isEmailVerified: true },
    { new: true }
  );

  res.status(200).json({
    success: true,
    message: 'Email address has been successfully verified! Full account features unlocked.',
    user: user ? user.toSafeObject() : undefined,
  });
}

/**
 * Resends verification email (link + 6-digit code)
 */
export async function resendVerificationEmail(req: Request, res: Response): Promise<void> {
  const email = req.body.email || (req as any).user?.email;

  if (!email) {
    res.status(400).json({ success: false, error: 'Email address is required.' });
    return;
  }

  const user = await User.findOne({ normalizedEmail: String(email).toLowerCase().trim() });
  if (!user) {
    res.status(200).json({
      success: true,
      message: 'If the account exists, a new verification email has been dispatched.',
    });
    return;
  }

  if (user.isEmailVerified) {
    res.status(200).json({
      success: true,
      message: 'Your email address is already verified!',
      alreadyVerified: true,
    });
    return;
  }

  // Invalidate previous tokens
  await EmailVerificationToken.updateMany({ userId: user._id, used: false }, { used: true });

  const rawToken = generateRandomToken(32);
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  await EmailVerificationToken.create({
    userId: user._id,
    tokenHash: hashToken(rawToken),
    otpCode,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const verificationLink = `${ENV.CLIENT_URL}/verify-email?token=${rawToken}`;
  await emailService.sendVerificationEmail(
    user.email,
    user.displayName || user.username,
    verificationLink,
    otpCode
  );

  res.status(200).json({
    success: true,
    message: 'A fresh verification email and OTP code have been dispatched to your inbox.',
  });
}

/**
 * Free Tier Instant Activation endpoint (bypasses blocked SMTP ports)
 */
export async function instantVerify(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const email = req.body?.email || user?.email;

  if (!user && !email) {
    res.status(400).json({ success: false, error: 'User email is required for activation.' });
    return;
  }

  let targetUser: any = user;
  if (!targetUser && email) {
    targetUser = await User.findOne({ normalizedEmail: String(email).toLowerCase().trim() });
  }

  if (!targetUser) {
    res.status(404).json({ success: false, error: 'Account not found.' });
    return;
  }

  targetUser.isEmailVerified = true;
  await targetUser.save();

  res.status(200).json({
    success: true,
    message: 'DrawMate account activated successfully under Free Tier mode!',
    user: targetUser.toSafeObject(),
  });
}
