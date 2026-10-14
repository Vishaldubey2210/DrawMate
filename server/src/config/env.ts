import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env if present
dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'drawmate-dev-access-secret-38917294871239',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'drawmate-dev-refresh-secret-98172381273918',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'drawmate-dev-cookie-secret-12345',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  AI_PROVIDER: process.env.AI_PROVIDER || 'auto',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  SKETCH_RECOGNIZER_URL: process.env.SKETCH_RECOGNIZER_URL || 'http://localhost:8000',
  // Resend / Brevo HTTPS Email API (Port 443 — works seamlessly on Render Free Tier)
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  BREVO_API_KEY: process.env.BREVO_API_KEY || '',
  // SMTP Email Configuration
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_PORT === '465' || (process.env.SMTP_SECURE === 'true' && process.env.SMTP_PORT !== '587'),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '',
  SMTP_FROM: process.env.SMTP_FROM || 'DrawMate <no-reply@drawmate.app>',
};

/**
 * Validates environment variables for production security and integrity
 */
export function validateEnv(customEnv = ENV): void {
  if (customEnv.NODE_ENV === 'production') {
    const defaultAccess = 'drawmate-dev-access-secret-38917294871239';
    const defaultRefresh = 'drawmate-dev-refresh-secret-98172381273918';
    const defaultCookie = 'drawmate-dev-cookie-secret-12345';

    if (!customEnv.MONGODB_URI) {
      throw new Error('FATAL: MONGODB_URI is required when NODE_ENV=production');
    }
    if (!process.env.JWT_ACCESS_SECRET || customEnv.JWT_ACCESS_SECRET === defaultAccess) {
      throw new Error('FATAL: A secure, non-default JWT_ACCESS_SECRET is required in production');
    }
    if (customEnv.JWT_ACCESS_SECRET.length < 32) {
      throw new Error('FATAL: JWT_ACCESS_SECRET must be at least 32 characters long in production');
    }
    if (!process.env.JWT_REFRESH_SECRET || customEnv.JWT_REFRESH_SECRET === defaultRefresh) {
      throw new Error('FATAL: A secure, non-default JWT_REFRESH_SECRET is required in production');
    }
    if (customEnv.JWT_REFRESH_SECRET.length < 32) {
      throw new Error('FATAL: JWT_REFRESH_SECRET must be at least 32 characters long in production');
    }
    if (!process.env.COOKIE_SECRET || customEnv.COOKIE_SECRET === defaultCookie) {
      throw new Error('FATAL: A secure, non-default COOKIE_SECRET is required in production');
    }
    if (customEnv.COOKIE_SECRET.length < 32) {
      throw new Error('FATAL: COOKIE_SECRET must be at least 32 characters long in production');
    }
    if (!customEnv.CLIENT_URL || customEnv.CLIENT_URL === '*') {
      throw new Error('FATAL: CLIENT_URL must be explicitly configured and cannot be wildcard "*" in production');
    }
  }
}
