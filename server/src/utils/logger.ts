import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  transport:
    config.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  redact: {
    // Never log these fields even at debug level
    paths: [
      'YOUTUBE_API_KEY',
      'GEMINI_API_KEY',
      'OPENAI_API_KEY',
      'req.headers.authorization',
      'body.key',
    ],
    censor: '[REDACTED]',
  },
});

export type Logger = typeof logger;
