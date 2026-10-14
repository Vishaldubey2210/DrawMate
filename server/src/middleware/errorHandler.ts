import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { ENV } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { incidentDiagnosticService } from '../services/IncidentDiagnosticService.js';

export interface ApiErrorResponse {
  success: false;
  error: string;
  statusCode: number;
  details?: any;
  stack?: string;
}

export class AppError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode = 400, details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || 'Internal Server Error';
  let details: any = undefined;

  // 1. Zod Schema Validation Errors
  if (err instanceof ZodError) {
    statusCode = 400;
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    message = formattedErrors.map((e) => `${e.field}: ${e.message}`).join(', ') || 'Validation error';
    details = formattedErrors;
  }
  // 2. Mongoose Validation Errors
  else if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    const mongoErrors = Object.values(err.errors).map((val: any) => ({
      field: val.path,
      message: val.message,
    }));
    message = mongoErrors.map((e) => e.message).join(', ') || 'Database validation error';
    details = mongoErrors;
  }
  // 3. Mongoose Invalid ObjectId CastError
  else if (err.name === 'CastError' || err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid resource identifier format: ${err.path}`;
    details = { path: err.path, value: err.value };
  }
  // 4. Mongo Duplicate Key Error (E11000)
  else if (err.code === 11000 && err.keyValue) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `A record with this ${field} already exists.`;
    details = err.keyValue;
  }
  // 5. JWT Errors
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired. Please sign in again.';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token provided.';
  }
  // 6. JSON syntax parse errors in request body
  else if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON in request body.';
  }

  // Log error using structured logger
  const logContext = `${req.method} ${req.originalUrl || req.url}`;
  if (statusCode >= 500) {
    logger.error(`[Error] 500 Server Exception on ${logContext}`, err, 'ErrorHandler');
    incidentDiagnosticService.recordIncident('internal', message, {
      path: req.originalUrl,
      method: req.method,
      statusCode,
    });
  } else {
    logger.warn(`[ClientError] ${statusCode} on ${logContext}: ${message}`, { details }, 'ErrorHandler');
  }

  const responsePayload: ApiErrorResponse = {
    success: false,
    error: message,
    statusCode,
    ...(details ? { details } : {}),
    ...(ENV.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  };

  res.status(statusCode).json(responsePayload);
}
