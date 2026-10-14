import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { generateRandomToken } from './token.js';

export interface JwtPayload {
  userId: string;
  username: string;
  email: string;
  nonce?: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, ENV.JWT_ACCESS_SECRET, {
    expiresIn: ENV.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(
    {
      ...payload,
      nonce: generateRandomToken(16),
    },
    ENV.JWT_REFRESH_SECRET,
    {
      expiresIn: ENV.JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions
  );
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, ENV.JWT_ACCESS_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, ENV.JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
