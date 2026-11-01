import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, friendlyMessages } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const requestId = req.requestId;

  if (err instanceof ZodError) {
    logger.warn({ requestId, issues: err.issues }, 'Validation error');
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    logger.warn({ requestId, code: err.code, statusCode: err.statusCode }, err.message);
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: friendlyMessages[err.code] ?? err.message,
        details: err.details,
      },
    });
    return;
  }

  // Unknown error
  logger.error({ requestId, err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal server error occurred.',
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
