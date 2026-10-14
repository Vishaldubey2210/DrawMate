import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { User, IUser } from '../models/User.js';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
  userId?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. No token provided.',
      });
      return;
    }

    const payload = verifyAccessToken(token);
    if (!payload || !payload.userId) {
      res.status(401).json({
        success: false,
        error: 'Session expired or invalid token. Please log in again.',
      });
      return;
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User account no longer exists.',
      });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({
        success: false,
        error: 'Account has been suspended.',
      });
      return;
    }

    if (user.suspendedUntil) {
      if (user.suspendedUntil > new Date()) {
        res.status(403).json({
          success: false,
          error: `Account is temporarily suspended until ${user.suspendedUntil.toISOString()}.`,
        });
        return;
      } else {
        // Temporary suspension expired, clear it
        user.suspendedUntil = undefined;
        await user.save();
      }
    }

    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Authentication verification failure.',
    });
  }
}

export function requireRole(roles: ('user' | 'moderator' | 'admin')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden. You do not have sufficient permissions to perform this action.',
      });
      return;
    }

    next();
  };
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    }

    if (token) {
      const payload = verifyAccessToken(token);
      if (payload && payload.userId) {
        const user = await User.findById(payload.userId);
        if (user && user.status === 'active') {
          req.user = user;
          req.userId = user._id.toString();
        }
      }
    }
  } catch {
    // Ignore error in optional auth
  }
  next();
}
