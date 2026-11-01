import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/database.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info({ demo: config.IS_DEMO, provider: config.AI_PROVIDER }, '🚀 Starting Social Pulse server');

  await connectDB();

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info(
      { port: config.PORT, demo: config.IS_DEMO },
      `✅ Server listening on http://localhost:${config.PORT}`
    );
  });

  // ─── Graceful shutdown ────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(async () => {
      await disconnectDB();
      logger.info('Server shut down gracefully');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection');
    process.exit(1);
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
