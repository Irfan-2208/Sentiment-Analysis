import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * B1 cache migration: old cache keys used batch-local ids (c000..cNNN) which caused
 * cross-comment cache poisoning. Delete all existing cache entries on startup so
 * stale/corrupt results are evicted. New entries use content-hash keys.
 */
async function migrateCache(): Promise<void> {
  try {
    // Lazy import to avoid circular deps at startup
    const { AnalysisCache } = await import('../models/AnalysisCache.js');
    // Delete all entries — they may have been keyed on batch-local ids
    const { deletedCount } = await AnalysisCache.deleteMany({
      // Only delete old-format keys (format: "model:promptVersion:c{NNN}")
      key: { $regex: /:[a-z][0-9]+$/ },
    });
    if (deletedCount && deletedCount > 0) {
      logger.info({ deletedCount }, 'B1 cache migration: removed old-format cache entries');
    }
  } catch (err) {
    // Non-fatal — just log
    logger.warn({ err }, 'Cache migration failed (non-fatal)');
  }
}

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  // Try the configured URI first
  try {
    await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    isConnected = true;
    logger.info({ uri: config.MONGODB_URI.replace(/\/\/.*@/, '//[REDACTED]@') }, '✅ MongoDB connected');
    _attachListeners();
    await migrateCache();
    return;
  } catch {
    logger.warn(
      { uri: config.MONGODB_URI },
      '⚠️  MongoDB unreachable — falling back to in-memory database (data will not persist across restarts)'
    );
  }

  // Fallback: use mongodb-memory-server (works with no external MongoDB)
  try {
    // Dynamic import so it's not bundled into prod unless needed
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    isConnected = true;
    logger.info('✅ Using in-memory MongoDB (mongodb-memory-server) — demo/dev only');
    _attachListeners();
    await migrateCache();

    // Shut down the in-memory server with the process
    process.on('exit', () => mongod.stop());
    process.on('SIGINT', async () => { await mongod.stop(); process.exit(0); });
    process.on('SIGTERM', async () => { await mongod.stop(); process.exit(0); });
  } catch (err) {
    logger.error({ err }, '❌ Both MongoDB and fallback in-memory DB failed to start');
    throw err;
  }
}

function _attachListeners() {
  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error');
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
    isConnected = false;
  });
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected gracefully');
}

export async function checkDBHealth(): Promise<boolean> {
  try {
    if (mongoose.connection.readyState !== 1) return false;
    await mongoose.connection.db?.admin().ping();
    return true;
  } catch {
    return false;
  }
}
