import { Request, Response } from 'express';
import mongoose from 'mongoose';

const startTime = Date.now();

export function getHealth(req: Request, res: Response): void {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const memUsage = process.memoryUsage();

  res.status(200).json({
    status: 'healthy',
    service: 'drawmate-api',
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    memory: {
      rssMb: Math.round(memUsage.rss / 1024 / 1024),
      heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
    },
  });
}

export function getReadiness(req: Request, res: Response): void {
  const dbState = mongoose.connection.readyState;
  // 1 = connected
  if (dbState === 1) {
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
}
