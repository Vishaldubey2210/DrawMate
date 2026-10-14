import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { operationalMetrics } from '../services/OperationalMetrics.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Suppress noisiness for automated health checks if needed, but still allow debug
  if (req.originalUrl === '/api/health') {
    return next();
  }

  const startTime = process.hrtime.bigint();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const formattedDuration = `${durationMs.toFixed(2)}ms`;
    const statusCode = res.statusCode;

    // Record operational metric
    operationalMetrics.recordHttpRequest(statusCode, durationMs);

    const logPayload = {
      method: req.method,
      url: req.originalUrl || req.url,
      status: statusCode,
      duration: formattedDuration,
      ip: clientIp,
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    const message = `${req.method} ${req.originalUrl || req.url} ${statusCode} - ${formattedDuration}`;

    if (statusCode >= 500) {
      logger.error(`[HTTP] ${message}`, logPayload, 'HTTP');
    } else if (statusCode >= 400) {
      logger.warn(`[HTTP] ${message}`, logPayload, 'HTTP');
    } else {
      logger.info(`[HTTP] ${message}`, logPayload, 'HTTP');
    }
  });

  next();
}
