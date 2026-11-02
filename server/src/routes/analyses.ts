import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import multer from 'multer';
import { Analysis } from '../models/Analysis.js';
import { Comment } from '../models/Comment.js';
import { extractVideoId } from '../services/youtube/urlParser.js';
import { parseFlipkartUrl } from '../services/sources/flipkartUrlParser.js';
import type { SourceInput } from '../services/sources/types.js';
import { runAnalysisJob, cancelJob, isJobRunning } from '../queue/jobRunner.js';
import { sseEmitter } from '../queue/sseEmitter.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import {
  CreateAnalysisRequestSchema,
  AnalysisOptionsSchema,
  ListAnalysesQuerySchema,
  ListCommentsQuerySchema,
} from '@social-pulse/shared';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

export const analysesRouter = Router();

// Middleware to preprocess multipart/form-data before Zod validation
function multipartJsonPreprocessor(req: Request, _res: Response, next: NextFunction) {
  if (req.body) {
    if (typeof req.body.options === 'string') {
      try {
        req.body.options = JSON.parse(req.body.options);
      } catch {
        // Leave as is
      }
    }
    if (typeof req.body.productMeta === 'string') {
      try {
        req.body.productMeta = JSON.parse(req.body.productMeta);
      } catch {
        // Leave as is
      }
    }
    if (typeof req.body.rawReviews === 'string') {
      try {
        req.body.rawReviews = JSON.parse(req.body.rawReviews);
      } catch {
        // Leave as is
      }
    }
  }
  next();
}

// ─── POST /api/analyses ───────────────────────────────────────────────────────
analysesRouter.post(
  '/',
  upload.single('file'),
  multipartJsonPreprocessor,
  validate(CreateAnalysisRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        platform = 'youtube',
        url = '',
        pastedText,
        rawReviews: bodyRawReviews,
        productMeta,
        options: rawOptions,
      } = req.body as z.infer<typeof CreateAnalysisRequestSchema>;

      const options = AnalysisOptionsSchema.parse(rawOptions ?? {});

      let videoId = '';
      let fileCsvContent: string | undefined;
      let fileRawReviews = bodyRawReviews;

      if (req.file) {
        const fileContent = req.file.buffer.toString('utf-8');
        const filename = req.file.originalname?.toLowerCase() || '';
        if (filename.endsWith('.json') || req.file.mimetype === 'application/json') {
          try {
            const parsed = JSON.parse(fileContent);
            if (Array.isArray(parsed)) {
              fileRawReviews = parsed;
            } else if (parsed && typeof parsed === 'object') {
              fileRawReviews = parsed.reviews || parsed.data || [parsed];
            }
          } catch {
            fileCsvContent = fileContent;
          }
        } else {
          fileCsvContent = fileContent;
        }
      }

      if (platform === 'youtube') {
        if (!url) {
          throw new AppError('INVALID_INPUT', 'YouTube URL is required', 400);
        }
        if (config.IS_DEMO) {
          extractVideoId(url);
          videoId = 'dQw4w9WgXcQ';
        } else {
          videoId = extractVideoId(url);
        }
      } else {
        // Flipkart
        if (url) {
          const parsedFk = parseFlipkartUrl(url);
          videoId = parsedFk?.productId || 'fk-product';
        } else {
          videoId = 'fk-upload';
        }
      }

      const sourceInput: SourceInput = {
        url: url || undefined,
        videoId,
        pastedText,
        rawReviews: fileRawReviews as any,
        productMeta,
        csvContent: fileCsvContent,
      };

      // Create analysis record
      const analysis = await Analysis.create({
        platform,
        videoId,
        url,
        productMeta: productMeta ?? null,
        options: {
          ...options,
          model: options.provider === 'gemini' ? config.GEMINI_MODEL : options.model,
          promptVersion: config.PROMPT_VERSION,
        },
        status: 'pending',
        stage: 'validating',
        progress: { stage: 'validating', fetched: 0, analyzed: 0, total: 0 },
        demo: config.IS_DEMO,
      });

      // Start job in background (do not await)
      setImmediate(() => {
        runAnalysisJob(analysis._id.toString(), options, sourceInput).catch((err) => {
          logger.error({ analysisId: analysis._id, err }, 'Job runner crashed');
        });
      });

      res.status(201).json({
        analysisId: analysis._id.toString(),
        status: 'pending',
        demo: config.IS_DEMO,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/analyses ────────────────────────────────────────────────────────
analysesRouter.get(
  '/',
  validate(ListAnalysesQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as z.infer<typeof ListAnalysesQuerySchema>;
      const filter: Record<string, unknown> = {};

      if (query.q) {
        filter.$or = [
          { 'videoMeta.title': { $regex: query.q, $options: 'i' } },
          { 'productMeta.title': { $regex: query.q, $options: 'i' } },
        ];
      }
      if (query.status) {
        filter.status = query.status;
      }

      const total = await Analysis.countDocuments(filter);
      const analyses = await Analysis.find(filter)
        .sort(query.sort === 'createdAt' ? { createdAt: 1 } : { createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean();

      res.json({
        data: analyses.map(formatAnalysis),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
          hasNext: query.page * query.limit < total,
          hasPrev: query.page > 1,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/analyses/:id ────────────────────────────────────────────────────
analysesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const analysis = await Analysis.findById(req.params.id).lean();
    if (!analysis) throw new NotFoundError('Analysis not found');
    res.json({ data: formatAnalysis(analysis) });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/analyses/:id ─────────────────────────────────────────────────
analysesRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const analysis = await Analysis.findByIdAndDelete(req.params.id);
    if (!analysis) throw new NotFoundError('Analysis not found');
    await Comment.deleteMany({ analysisId: analysis._id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/analyses/:id/events (SSE) ──────────────────────────────────────
analysesRouter.get('/:id/events', async (req: Request, res: Response): Promise<void> => {
  const analysisId = req.params.id;

  // Verify analysis exists
  const analysis = await Analysis.findById(analysisId).lean();
  if (!analysis) {
    res.status(404).json({ error: { code: 'ANALYSIS_NOT_FOUND', message: 'Analysis not found' } });
    return;
  }

  // If already done, just return the current state immediately
  if (analysis.status === 'done' || analysis.status === 'failed' || analysis.status === 'cancelled') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const eventType = analysis.status === 'done' ? 'done' : analysis.status;
    res.write(`data: ${JSON.stringify({ type: eventType, analysisId, data: { stats: analysis.stats, insight: analysis.insight } })}\n\n`);
    res.end();
    return;
  }

  // Set up SSE stream
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send heartbeat every 15s to prevent timeout
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15_000);

  const unsubscribe = sseEmitter.subscribe(analysisId, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);

    if (event.type === 'done' || event.type === 'error' || event.type === 'cancelled') {
      clearInterval(heartbeat);
      unsubscribe();
      setTimeout(() => res.end(), 1000);
    }
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// ─── DELETE /api/analyses/:id/job (cancel) ────────────────────────────────────
analysesRouter.delete('/:id/job', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cancelled = cancelJob(req.params.id);
    if (!cancelled) {
      throw new AppError('ANALYSIS_NOT_FOUND', 'No running job found for this analysis', 404);
    }
    res.json({ message: 'Cancellation requested' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/analyses/:id/comments ──────────────────────────────────────────
analysesRouter.get(
  '/:id/comments',
  validate(ListCommentsQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const analysisId = new mongoose.Types.ObjectId(req.params.id);
      const query = req.query as unknown as z.infer<typeof ListCommentsQuerySchema>;

      const filter: Record<string, unknown> = {
        analysisId,
        isSpam: false,
        isDuplicateOf: null,
        analysis: { $ne: null },
      };

      if (query.sentiment) filter['analysis.sentiment'] = query.sentiment;
      if (query.language) filter['analysis.language'] = query.language;
      if (query.sarcastic) filter['analysis.isSarcastic'] = true;
      if (query.toxic) filter['analysis.isToxic'] = true;
      if (query.aspect) filter['analysis.aspects.aspect'] = { $regex: query.aspect, $options: 'i' };
      if (query.q) filter.normalizedText = { $regex: query.q, $options: 'i' };
      if (typeof query.rating === 'number') filter.rating = query.rating;
      if (query.mismatch) filter.ratingMismatch = true;

      const sortMap: Record<string, Record<string, 1 | -1>> = {
        likeCount: { likeCount: 1 },
        '-likeCount': { likeCount: -1 },
        publishedAt: { publishedAt: 1 },
        '-publishedAt': { publishedAt: -1 },
        score: { 'analysis.score': 1 },
        '-score': { 'analysis.score': -1 },
        rating: { rating: 1 },
        '-rating': { rating: -1 },
      };
      const sort = sortMap[query.sort ?? '-likeCount'] ?? { likeCount: -1 };

      const total = await Comment.countDocuments(filter);
      const comments = await Comment.find(filter)
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean();

      res.json({
        data: comments.map(formatComment),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
          hasNext: query.page * query.limit < total,
          hasPrev: query.page > 1,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/analyses/:id/export ────────────────────────────────────────────
analysesRouter.get('/:id/export', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const analysisId = new mongoose.Types.ObjectId(req.params.id);

    const analysis = await Analysis.findById(analysisId).lean();
    if (!analysis) throw new NotFoundError('Analysis not found');

    const comments = await Comment.find({
      analysisId,
      isSpam: false,
      isDuplicateOf: null,
      analysis: { $ne: null },
    }).lean();

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="analysis-${analysisId}.json"`);
      res.json({ analysis: formatAnalysis(analysis), comments: comments.map(formatComment) });
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analysis-${analysisId}.csv"`);
      const header = 'id,text,rating,reviewTitle,ratingMismatch,likeCount,publishedAt,sentiment,score,confidence,emotion,language,isSarcastic,isMixed,isToxic,keywords\n';
      const rows = comments
        .map((c) => {
          const a = c.analysis;
          if (!a) return '';
          return [
            c._id,
            `"${(c.normalizedText ?? '').replace(/"/g, '""')}"`,
            c.rating ?? '',
            `"${(c.reviewTitle ?? '').replace(/"/g, '""')}"`,
            c.ratingMismatch ?? false,
            c.likeCount,
            c.publishedAt ?? '',
            a.sentiment,
            a.score,
            a.confidence,
            a.emotion,
            a.language,
            a.isSarcastic,
            a.isMixed,
            a.isToxic,
            `"${(a.keywords ?? []).join(';')}"`,
          ].join(',');
        })
        .filter(Boolean)
        .join('\n');
      res.send(header + rows);
    }
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/analyses/:id/reanalyze ────────────────────────────────────────
analysesRouter.post('/:id/reanalyze', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const analysis = await Analysis.findById(req.params.id);
    if (!analysis) throw new NotFoundError('Analysis not found');

    if (isJobRunning(req.params.id)) {
      throw new AppError('ANALYSIS_ALREADY_RUNNING', 'Analysis is already running', 409);
    }

    // Reset state
    await Comment.deleteMany({ analysisId: analysis._id });
    await analysis.updateOne({
      $set: {
        status: 'pending',
        stage: 'validating',
        progress: { stage: 'validating', fetched: 0, analyzed: 0, total: 0 },
        stats: null,
        insight: null,
        jobErrors: [],
        finishedAt: null,
      },
    });

    setImmediate(() => {
      runAnalysisJob(analysis._id.toString(), analysis.options as z.infer<typeof AnalysisOptionsSchema>).catch((err) => {
        logger.error({ analysisId: analysis._id, err }, 'Reanalyze job failed');
      });
    });

    res.json({ analysisId: req.params.id, status: 'pending' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/compare ────────────────────────────────────────────────────────
analysesRouter.get('/compare/run', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { a, b } = req.query as { a?: string; b?: string };
    if (!a || !b) {
      throw new AppError('VALIDATION_ERROR', 'Both a and b analysis IDs are required', 400);
    }

    const [analysisA, analysisB] = await Promise.all([
      Analysis.findById(a).lean(),
      Analysis.findById(b).lean(),
    ]);

    if (!analysisA) throw new NotFoundError(`Analysis ${a} not found`);
    if (!analysisB) throw new NotFoundError(`Analysis ${b} not found`);

    const delta = {
      averageScore: (analysisB.stats?.averageScore ?? 0) - (analysisA.stats?.averageScore ?? 0),
      positivePercent:
        (analysisB.stats?.sentimentPercentages?.positive ?? 0) -
        (analysisA.stats?.sentimentPercentages?.positive ?? 0),
      negativePercent:
        (analysisB.stats?.sentimentPercentages?.negative ?? 0) -
        (analysisA.stats?.sentimentPercentages?.negative ?? 0),
      neutralPercent:
        (analysisB.stats?.sentimentPercentages?.neutral ?? 0) -
        (analysisA.stats?.sentimentPercentages?.neutral ?? 0),
      sarcasticCount: (analysisB.stats?.sarcasticCount ?? 0) - (analysisA.stats?.sarcasticCount ?? 0),
      toxicCount: (analysisB.stats?.toxicCount ?? 0) - (analysisA.stats?.toxicCount ?? 0),
      totalAnalyzed: (analysisB.stats?.totalAnalyzed ?? 0) - (analysisA.stats?.totalAnalyzed ?? 0),
    };

    res.json({
      data: {
        a: formatAnalysis(analysisA),
        b: formatAnalysis(analysisB),
        delta,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/analyses/:id/comments/:commentId/override ────────────────────
analysesRouter.patch(
  '/:id/comments/:commentId/override',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sentiment } = req.body as { sentiment: string };
      const validSentiments = ['positive', 'negative', 'neutral'];
      if (!validSentiments.includes(sentiment)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid sentiment value', 400);
      }

      const comment = await Comment.findOneAndUpdate(
        { _id: req.params.commentId, analysisId: new mongoose.Types.ObjectId(req.params.id) },
        {
          $set: {
            userOverride: { sentiment, overriddenAt: new Date() },
          },
        },
        { new: true }
      );

      if (!comment) throw new NotFoundError('Comment not found');
      res.json({ data: formatComment(comment.toObject()) });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Formatters ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatAnalysis(a: any) {
  return {
    id: a._id?.toString(),
    platform: a.platform ?? 'youtube',
    videoId: a.videoId,
    url: a.url,
    videoMeta: a.videoMeta,
    productMeta: a.productMeta,
    options: a.options,
    status: a.status,
    stage: a.stage,
    progress: a.progress,
    stats: a.stats,
    insight: a.insight,
    errors: a.jobErrors,
    demo: a.demo,
    usedFallback: a.usedFallback,
    createdAt: a.createdAt,
    finishedAt: a.finishedAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatComment(c: any) {
  return {
    id: c._id?.toString(),
    analysisId: c.analysisId?.toString(),
    externalId: c.externalId,
    text: c.text,
    normalizedText: c.normalizedText,
    likeCount: c.likeCount,
    publishedAt: c.publishedAt,
    isReply: c.isReply,
    isDuplicateOf: c.isDuplicateOf,
    duplicateCount: c.duplicateCount,
    isSpam: c.isSpam,
    rating: c.rating,
    reviewTitle: c.reviewTitle,
    ratingMismatch: c.ratingMismatch,
    analysis: c.analysis,
    source: c.source,
    signals: c.signals,
    reasoning: c.reasoning,
    needsReview: c.needsReview,
    engineVersion: c.engineVersion,
    userOverride: c.userOverride,
  };
}
