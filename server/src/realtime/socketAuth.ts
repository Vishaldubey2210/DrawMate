import { Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.js';
import { User } from '../models/User.js';

export interface AuthenticatedSocketUser {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  role: 'user' | 'moderator' | 'admin';
}

export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    let token: string | undefined = socket.handshake.auth?.token;

    // Check cookie fallback if not provided in auth payload
    if (!token && socket.handshake.headers.cookie) {
      const match = socket.handshake.headers.cookie.match(/access_token=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }

    if (!token) {
      return next(new Error('Authentication required: No token provided in handshake.'));
    }

    const payload = verifyAccessToken(token);
    if (!payload || !payload.userId) {
      return next(new Error('Authentication failed: Invalid or expired token.'));
    }

    const user = await User.findById(payload.userId);
    if (!user || user.status !== 'active') {
      return next(new Error('Authentication failed: Account not active.'));
    }

    if (user.suspendedUntil && user.suspendedUntil > new Date()) {
      return next(new Error('Authentication failed: Account suspended.'));
    }

    socket.data.user = {
      userId: user._id.toString(),
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      role: user.role || 'user',
    };

    next();
  } catch (err: any) {
    next(new Error('Internal socket authentication error.'));
  }
}
