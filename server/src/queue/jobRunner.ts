import mongoose from 'mongoose';
import { Analysis } from '../models/Analysis.js';
import { Comment } from '../models/Comment.js';
import { preprocessComments } from '../services/preprocess/normalizer.js';
import { deduplicateComments } from '../services/preprocess/deduplicator.js';
import { flagSpam } from '../services/preprocess/spamDetector.js';
import { getProvider } from '../services/ai/providerFactory.js';
import { dispatchBatches } from '../services/ai/batchDispatcher.js';
import { computeStats } from '../services/aggregate/computeStats.js';
import { getSourceAdapter } from '../services/sources/adapterRegistry.js';
import type { SourceInput } from '../services/sources/types.js';
import { sseEmitter } from './sseEmitter.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { AnalysisOptions, VideoMeta, ProductMeta } from '@social-pulse/shared';

// Track running jobs for cancellation
const runningJobs = new Map<string, { cancelled: boolean }>();

export function cancelJob(analysisId: string): boolean {
  const job = runningJobs.get(analysisId);
  if (job) {
    job.cancelled = true;
    return true;
  }
  return false;
}

export function isJobRunning(analysisId: string): boolean {
  return runningJobs.has(analysisId);
}

/**
 * Runs the full analysis pipeline in the background.
 * Emits SSE events at each stage.
 */
export async function runAnalysisJob(
  analysisId: string,
  options: AnalysisOptions,
  sourceInput?: SourceInput
): Promise<void> {
  const jobToken = { cancelled: false };
  runningJobs.set(analysisId, jobToken);
  const mongoId = new mongoose.Types.ObjectId(analysisId);

  const emit = (type: string, data: unknown) => {
    sseEmitter.emit(analysisId, { type: type as 'progress', analysisId, data });
  };

  const updateAnalysis = async (update: Record<string, unknown>) => {
    await Analysis.findByIdAndUpdate(analysisId, { $set: update });
  };

  const checkCancelled = () => {
    if (jobToken.cancelled) throw new Error('CANCELLED');
  };

  try {
    // ── Stage: validating ──────────────────────────────────
    await updateAnalysis({ status: 'running', stage: 'validating', 'progress.stage': 'validating' });
    emit('progress', { stage: 'validating', fetched: 0, analyzed: 0, total: 0 });

    const isDemo = config.IS_DEMO;
    const analysis = await Analysis.findById(analysisId);
    if (!analysis) throw new Error('Analysis not found');

    const platform = analysis.platform ?? 'youtube';
    const adapter = getSourceAdapter(platform);

    const effectiveInput: SourceInput = sourceInput ?? {
      url: analysis.url,
      videoId: analysis.videoId,
      productMeta: analysis.productMeta ?? undefined,
    };

    const validatedInput = await adapter.validateInput(effectiveInput);
    const meta = await adapter.fetchMeta(validatedInput);

    if (platform === 'flipkart') {
      await updateAnalysis({ productMeta: meta as ProductMeta });
    } else {
      await updateAnalysis({ videoMeta: meta as VideoMeta });
    }
    checkCancelled();

    // ── Stage: fetching ───────────────────────────────────
    await updateAnalysis({ stage: 'fetching', 'progress.stage': 'fetching' });
    const targetFetchTotal =
      options.maxComments > 0
        ? options.maxComments
        : platform === 'flipkart'
          ? (meta as ProductMeta).reviewCount || 0
          : (meta as VideoMeta).commentCount || 0;
    emit('progress', { stage: 'fetching', fetched: 0, analyzed: 0, total: targetFetchTotal });

    const rawComments = await adapter.fetchItems(
      validatedInput,
      {
        maxItems: options.maxComments,
        order: options.order,
        includeReplies: options.includeReplies,
      },
      (fetched) => {
        emit('progress', {
          stage: 'fetching',
          fetched,
          analyzed: 0,
          total: options.maxComments > 0 ? options.maxComments : Math.max(fetched, targetFetchTotal),
        });
      }
    );

    const totalFetched = rawComments.length;
    await updateAnalysis({ 'progress.fetched': totalFetched, 'progress.total': totalFetched });
    checkCancelled();

    // ── Stage: preprocessing ──────────────────────────────
    await updateAnalysis({ stage: 'preprocessing', 'progress.stage': 'preprocessing' });
    emit('progress', { stage: 'preprocessing', fetched: totalFetched, analyzed: 0, total: totalFetched });

    const processed = preprocessComments(rawComments);
    const { unique, duplicateMap, duplicateCounts } = deduplicateComments(processed);
    const totalDeduplicated = totalFetched - unique.length;

    const spamFlags = flagSpam(unique);
    const totalSpamRemoved = spamFlags.filter(Boolean).length;
    const nonSpam = unique.filter((_, i) => !spamFlags[i]);

    logger.info({ totalFetched, totalDeduplicated, totalSpamRemoved, toAnalyze: nonSpam.length }, 'Preprocessing complete');

    // Persist all comments (including spam and duplicates)
    const commentDocs = unique.map((c, i) => ({
      analysisId: mongoId,
      externalId: c.externalId,
      text: c.text,
      normalizedText: c.normalizedText,
      hash: c.hash,
      likeCount: c.likeCount,
      publishedAt: c.publishedAt,
      isReply: c.isReply,
      isDuplicateOf: duplicateMap.get(c.externalId) ?? null,
      duplicateCount: duplicateCounts.get(c.externalId) ?? 0,
      isSpam: spamFlags[i],
      rating: c.rating,
      reviewTitle: c.reviewTitle,
      analysis: null,
      source: null,
      userOverride: null,
    }));

    // Also add back the duplicate entries
    for (const [dupId, canonicalId] of duplicateMap.entries()) {
      const original = processed.find((p) => p.externalId === dupId);
      if (!original) continue;
      commentDocs.push({
        analysisId: mongoId,
        externalId: dupId,
        text: original.text,
        normalizedText: original.normalizedText,
        hash: original.hash,
        likeCount: original.likeCount,
        publishedAt: original.publishedAt,
        isReply: original.isReply,
        isDuplicateOf: canonicalId,
        duplicateCount: 0,
        isSpam: false,
        rating: original.rating,
        reviewTitle: original.reviewTitle,
        analysis: null,
        source: null,
        userOverride: null,
      });
    }

    await Comment.insertMany(commentDocs, { ordered: false });
    checkCancelled();

    // ── Stage: analyzing ──────────────────────────────────
    await updateAnalysis({
      stage: 'analyzing',
      'progress.stage': 'analyzing',
      'progress.total': nonSpam.length,
      demo: isDemo,
    });
    emit('progress', { stage: 'analyzing', fetched: totalFetched, analyzed: 0, total: nonSpam.length });

    const provider = await getProvider();
    let usedFallback = false;

    const commentsForBatch = nonSpam.map((c) => ({
      externalId: c.externalId,
      normalizedText: c.normalizedText,
      hash: c.hash,
      platform,
      rating: c.rating,
    }));

    const dynamicBatchSize = nonSpam.length > 500 ? Math.max(config.BATCH_SIZE, 50) : config.BATCH_SIZE;
    const batchResults = await dispatchBatches(
      commentsForBatch,
      provider,
      options.promptVersion ?? config.PROMPT_VERSION,
      {
        batchSize: dynamicBatchSize,
        concurrency: config.AI_CONCURRENCY,
        onProgress: async (analyzed, total) => {
          if (jobToken.cancelled) return;
          await updateAnalysis({ 'progress.analyzed': analyzed });
          emit('progress', { stage: 'analyzing', fetched: totalFetched, analyzed, total });
        },
      }
    );

    // Write analysis results back to Comment documents (and copy to duplicates per B6)
    for (const res of batchResults) {
      if (res.source === 'fallback') usedFallback = true;
      const updateData = {
        analysis: res.result,
        source: res.source,
        signals: res.signals ?? null,
        reasoning: res.reasoning ?? null,
        needsReview: res.needsReview ?? false,
        engineVersion: res.engineVersion ?? null,
      };
      await Comment.findOneAndUpdate(
        { analysisId: mongoId, externalId: res.externalId },
        { $set: updateData }
      );
      // B6 fix: copy canonical analysis to duplicates so comment explorer shows results for them
      await Comment.updateMany(
        { analysisId: mongoId, isDuplicateOf: res.externalId },
        { $set: updateData }
      );
    }

    checkCancelled();

    // ── Stage: aggregating ────────────────────────────────
    await updateAnalysis({ stage: 'aggregating', 'progress.stage': 'aggregating' });
    emit('progress', { stage: 'aggregating', fetched: totalFetched, analyzed: batchResults.length, total: nonSpam.length });

    const stats = await computeStats(mongoId, totalFetched, totalDeduplicated, totalSpamRemoved);

    // Generate insight
    const representativeComments = await Comment.find({
      analysisId: mongoId,
      isSpam: false,
      isDuplicateOf: null,
      analysis: { $ne: null },
    })
      .sort({ likeCount: -1 })
      .limit(30)
      .lean();

    const representativeTexts = representativeComments.map((c) => c.normalizedText);
    const insight = await provider.generateInsight(JSON.stringify(stats), representativeTexts);

    // ── Done ──────────────────────────────────────────────
    await updateAnalysis({
      status: 'done',
      stage: 'done',
      'progress.stage': 'done',
      'progress.analyzed': batchResults.length,
      stats,
      insight,
      usedFallback,
      finishedAt: new Date(),
    });

    emit('done', { stats, insight });
    logger.info({ analysisId, provider: provider.name, usedFallback }, 'Analysis complete');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message === 'CANCELLED') {
      await updateAnalysis({ status: 'cancelled', stage: 'failed', finishedAt: new Date() });
      emit('cancelled', { reason: 'Job was cancelled by user' });
      logger.info({ analysisId }, 'Analysis cancelled');
    } else {
      logger.error({ analysisId, err }, 'Analysis job failed');
      await updateAnalysis({
        status: 'failed',
        stage: 'failed',
        finishedAt: new Date(),
        $push: { jobErrors: message },
      });
      emit('error', { message });
    }
  } finally {
    runningJobs.delete(analysisId);
    // Keep SSE subscribers subscribed for 30 seconds after completion
    setTimeout(() => sseEmitter.cleanup(analysisId), 30_000);
  }
}
