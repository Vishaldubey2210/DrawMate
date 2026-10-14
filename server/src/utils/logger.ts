import { ENV } from '../config/env.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel: LogLevel = (ENV.NODE_ENV === 'test' ? 'error' : (process.env.LOG_LEVEL as LogLevel) || 'info');

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'cookies',
  'authorization',
  'confirmpassword',
  'newpassword',
]);

function sanitizeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

class Logger {
  private formatPrefix(level: LogLevel, context?: string): string {
    const timestamp = new Date().toISOString();
    const isDev = ENV.NODE_ENV !== 'production';

    if (!isDev) {
      return `[${timestamp}] [${level.toUpperCase()}]${context ? ` [${context}]` : ''}`;
    }

    let color = COLORS.reset;
    switch (level) {
      case 'debug':
        color = COLORS.magenta;
        break;
      case 'info':
        color = COLORS.cyan;
        break;
      case 'warn':
        color = COLORS.yellow;
        break;
      case 'error':
        color = COLORS.red;
        break;
    }

    const tag = `${color}[${level.toUpperCase()}]${COLORS.reset}`;
    const ctx = context ? ` ${COLORS.dim}[${context}]${COLORS.reset}` : '';
    return `${COLORS.dim}${timestamp}${COLORS.reset} ${tag}${ctx}:`;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
  }

  public debug(message: string, meta?: any, context?: string): void {
    if (!this.shouldLog('debug')) return;
    const prefix = this.formatPrefix('debug', context);
    if (meta !== undefined) {
      console.debug(prefix, message, sanitizeData(meta));
    } else {
      console.debug(prefix, message);
    }
  }

  public info(message: string, meta?: any, context?: string): void {
    if (!this.shouldLog('info')) return;
    const prefix = this.formatPrefix('info', context);
    if (meta !== undefined) {
      console.info(prefix, message, sanitizeData(meta));
    } else {
      console.info(prefix, message);
    }
  }

  public warn(message: string, meta?: any, context?: string): void {
    if (!this.shouldLog('warn')) return;
    const prefix = this.formatPrefix('warn', context);
    if (meta !== undefined) {
      console.warn(prefix, message, sanitizeData(meta));
    } else {
      console.warn(prefix, message);
    }
  }

  public error(message: string, error?: any, context?: string): void {
    if (!this.shouldLog('error')) return;
    const prefix = this.formatPrefix('error', context);
    if (error instanceof Error) {
      console.error(prefix, message, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error as any),
      });
    } else if (error !== undefined) {
      console.error(prefix, message, sanitizeData(error));
    } else {
      console.error(prefix, message);
    }
  }
}

export const logger = new Logger();
