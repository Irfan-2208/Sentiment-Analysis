import pLimit from 'p-limit';
import type { BatchResult, AIProvider } from './provider.js';
import { shortId } from '../../utils/retry.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export interface CommentForBatch {
  externalId: string;
  normalizedText: string;
  hash: string;
}

export interface DispatchResult {
  externalId: string;
  batchId: string;
  result: BatchResult['result'];
  source: BatchResult['source'];
  signals?: Record<string, unknown>;
  reasoning?: string;
  needsReview?: boolean;
  engineVersion?: string;
}

/**
 * Dispatches comments to the AI provider in batches.
 * - Assigns stable short IDs (c000..cNNN) within each batch
 * - Concurrency-limited via p-limit
 * - Reports progress via onProgress callback
 */
export async function dispatchBatches(
  comments: CommentForBatch[],
  provider: AIProvider,
  promptVersion: string,
  options: {
    batchSize?: number;
    concurrency?: number;
    onProgress?: (analyzed: number, total: number) => void;
  } = {}
): Promise<DispatchResult[]> {
  const batchSize = options.batchSize ?? config.BATCH_SIZE;
  const concurrency = options.concurrency ?? config.AI_CONCURRENCY;
  const limit = pLimit(concurrency);

  // Build batches
  const batches: Array<{ items: Array<{ id: string; text: string; externalId: string }>; batchIndex: number }> = [];
  for (let i = 0; i < comments.length; i += batchSize) {
    const slice = comments.slice(i, i + batchSize);
    const items = slice.map((c, j) => ({
      id: shortId(j),
      text: c.normalizedText,
      externalId: c.externalId,
    }));
    batches.push({ items, batchIndex: Math.floor(i / batchSize) });
  }

  logger.info(
    { total: comments.length, batchSize, batches: batches.length, concurrency },
    'Starting batch dispatch'
  );

  let analyzed = 0;
  const allResults: DispatchResult[] = [];

  const batchPromises = batches.map((batch) =>
    limit(async () => {
      logger.debug({ batchIndex: batch.batchIndex, size: batch.items.length }, 'Processing batch');

      const batchItems = batch.items.map((item) => ({
        id: item.id,
        text: item.text,
      }));

      const results = await provider.analyzeBatch(batchItems, promptVersion);

      // Align results back to externalIds
      const resultMap = new Map(results.map((r) => [r.id, r]));

      for (const item of batch.items) {
        const result = resultMap.get(item.id);
        if (result) {
          allResults.push({
            externalId: item.externalId,
            batchId: item.id,
            result: result.result,
            source: result.source,
            signals: result.signals,
            reasoning: result.reasoning,
            needsReview: result.needsReview,
            engineVersion: result.engineVersion,
          });
        } else {
          // Should not happen (provider guarantees this), but handle defensively
          logger.error({ id: item.id, batchIndex: batch.batchIndex }, 'Result missing after batch — this is a bug');
        }
      }

      analyzed += batch.items.length;
      options.onProgress?.(analyzed, comments.length);
    })
  );

  await Promise.all(batchPromises);

  logger.info({ analyzed: allResults.length, total: comments.length }, 'Batch dispatch complete');
  return allResults;
}
