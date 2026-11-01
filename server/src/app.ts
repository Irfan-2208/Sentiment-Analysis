import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { analysesRouter } from './routes/analyses.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

export function createApp(): express.Application {
  const app = express();

  // ─── Security ─────────────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: config.CLIENT_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );

  // ─── Body parsing ─────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ─── Sanitization ─────────────────────────────────────────
  app.use(mongoSanitize());

  // ─── Request ID ───────────────────────────────────────────
  app.use(requestIdMiddleware);

  // ─── Rate limiting ────────────────────────────────────────
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 300,
      message: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP, please try again after 15 minutes.',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Stricter limit for POST /api/analyses
  app.use(
    '/api/analyses',
    rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20,
      skip: (req) => req.method !== 'POST',
      message: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Analysis creation limit reached. Please wait before creating more analyses.',
        },
      },
    })
  );

  // ─── Request logging ──────────────────────────────────────
  app.use((req, _res, next) => {
    logger.debug({ requestId: req.requestId, method: req.method, path: req.path }, 'Incoming request');
    next();
  });

  // ─── Routes ───────────────────────────────────────────────
  app.use('/api/health', healthRouter);
  app.use('/api/analyses', analysesRouter);

  // ─── Error handling ───────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
