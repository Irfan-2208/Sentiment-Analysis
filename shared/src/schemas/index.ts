import { z } from 'zod';

// ─── Sentiment ─────────────────────────────────────────────────────────────

export const SentimentSchema = z.enum(['positive', 'negative', 'neutral']);
export type Sentiment = z.infer<typeof SentimentSchema>;

export const EmotionSchema = z.enum([
  'joy',
  'anger',
  'sadness',
  'fear',
  'surprise',
  'disgust',
  'trust',
  'anticipation',
  'none',
]);
export type Emotion = z.infer<typeof EmotionSchema>;

export const LanguageSchema = z.enum(['en', 'hi', 'hinglish', 'other']);
export type Language = z.infer<typeof LanguageSchema>;

export const AspectSentimentSchema = z.object({
  aspect: z.string().min(1).max(50),
  sentiment: SentimentSchema,
});
export type AspectSentiment = z.infer<typeof AspectSentimentSchema>;

export const CommentAnalysisSchema = z.object({
  sentiment: SentimentSchema,
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  emotion: EmotionSchema,
  language: LanguageSchema,
  isSarcastic: z.boolean(),
  isMixed: z.boolean(),
  aspects: z.array(AspectSentimentSchema).max(10),
  keywords: z.array(z.string()).max(5),
  isToxic: z.boolean(),
});
export type CommentAnalysis = z.infer<typeof CommentAnalysisSchema>;

export const AnalysisSourceSchema = z.enum(['llm', 'ensemble', 'fallback', 'override']);
export type AnalysisSource = z.infer<typeof AnalysisSourceSchema>;

export const SignalsSchema = z
  .object({
    vader: z.object({ compound: z.number() }).optional(),
    hfSentiment: z.object({ label: z.string(), score: z.number() }).optional(),
    hfIrony: z.object({ score: z.number() }).optional(),
    hfEmotion: z.object({ label: z.string(), score: z.number() }).optional(),
    emoji: z.object({ score: z.number(), emojis: z.array(z.string()) }).optional(),
    lexicon: z.object({ score: z.number() }).optional(),
    lang: z.object({ script: z.string(), detected: z.string() }).optional(),
  })
  .optional();
export type Signals = z.infer<typeof SignalsSchema>;

// ─── Comment ───────────────────────────────────────────────────────────────

export const CommentSchema = z.object({
  id: z.string(),
  analysisId: z.string(),
  externalId: z.string(),
  text: z.string(),
  normalizedText: z.string(),
  hash: z.string(),
  likeCount: z.number().int().min(0),
  publishedAt: z.string().datetime().optional(),
  isReply: z.boolean(),
  isDuplicateOf: z.string().nullable(),
  duplicateCount: z.number().int().min(0),
  isSpam: z.boolean(),
  analysis: CommentAnalysisSchema.nullable(),
  source: AnalysisSourceSchema.nullable(),
  signals: SignalsSchema,
  reasoning: z.string().optional(),
  needsReview: z.boolean().optional(),
  engineVersion: z.string().optional(),
  userOverride: z
    .object({
      sentiment: SentimentSchema,
      overriddenAt: z.string().datetime(),
    })
    .nullable(),
});
export type Comment = z.infer<typeof CommentSchema>;

// ─── Video Meta ────────────────────────────────────────────────────────────

export const VideoMetaSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  channelTitle: z.string(),
  channelId: z.string(),
  thumbnailUrl: z.string().url().optional(),
  publishedAt: z.string().datetime(),
  viewCount: z.number().int().min(0),
  likeCount: z.number().int().min(0),
  commentCount: z.number().int().min(0),
  description: z.string().max(500).optional(),
});
export type VideoMeta = z.infer<typeof VideoMetaSchema>;

// ─── Analysis Options ──────────────────────────────────────────────────────

export const AnalysisOrderSchema = z.enum(['relevance', 'time']);
export type AnalysisOrder = z.infer<typeof AnalysisOrderSchema>;

export const MaxCommentsSchema = z.union([
  z.literal(100),
  z.literal(300),
  z.literal(500),
  z.literal(1000),
]);
export type MaxComments = z.infer<typeof MaxCommentsSchema>;

export const AIProviderSchema = z.enum(['gemini', 'openai', 'local']);
export type AIProvider = z.infer<typeof AIProviderSchema>;

export const AnalysisOptionsSchema = z.object({
  maxComments: MaxCommentsSchema.default(300),
  order: AnalysisOrderSchema.default('relevance'),
  includeReplies: z.boolean().default(false),
  provider: AIProviderSchema.default('gemini'),
  model: z.string().optional(),
  promptVersion: z.string().optional(),
});
export type AnalysisOptions = z.infer<typeof AnalysisOptionsSchema>;

// ─── Analysis Status ───────────────────────────────────────────────────────

export const AnalysisStatusSchema = z.enum(['pending', 'running', 'done', 'failed', 'cancelled']);
export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;

export const AnalysisStageSchema = z.enum([
  'validating',
  'fetching',
  'preprocessing',
  'analyzing',
  'aggregating',
  'done',
  'failed',
]);
export type AnalysisStage = z.infer<typeof AnalysisStageSchema>;

// ─── Aggregated Stats ─────────────────────────────────────────────────────

export const SentimentCountsSchema = z.object({
  positive: z.number().int().min(0),
  negative: z.number().int().min(0),
  neutral: z.number().int().min(0),
});
export type SentimentCounts = z.infer<typeof SentimentCountsSchema>;

export const TimePointSchema = z.object({
  bucket: z.string(),
  positive: z.number().int().min(0),
  negative: z.number().int().min(0),
  neutral: z.number().int().min(0),
  total: z.number().int().min(0),
});
export type TimePoint = z.infer<typeof TimePointSchema>;

export const KeywordStatSchema = z.object({
  keyword: z.string(),
  count: z.number().int().min(1),
  positive: z.number().int().min(0),
  negative: z.number().int().min(0),
  neutral: z.number().int().min(0),
});
export type KeywordStat = z.infer<typeof KeywordStatSchema>;

export const AspectStatSchema = z.object({
  aspect: z.string(),
  positive: z.number().int().min(0),
  negative: z.number().int().min(0),
  neutral: z.number().int().min(0),
  total: z.number().int().min(0),
});
export type AspectStat = z.infer<typeof AspectStatSchema>;

export const EmotionStatSchema = z.object({
  emotion: EmotionSchema,
  count: z.number().int().min(0),
});
export type EmotionStat = z.infer<typeof EmotionStatSchema>;

export const LanguageStatSchema = z.object({
  language: LanguageSchema,
  count: z.number().int().min(0),
});
export type LanguageStat = z.infer<typeof LanguageStatSchema>;

export const AnalysisStatsSchema = z.object({
  totalFetched: z.number().int().min(0),
  totalDeduplicated: z.number().int().min(0),
  totalSpamRemoved: z.number().int().min(0),
  totalAnalyzed: z.number().int().min(0),
  totalFallback: z.number().int().min(0),
  sentimentCounts: SentimentCountsSchema,
  sentimentPercentages: SentimentCountsSchema,
  averageScore: z.number().min(-1).max(1),
  sarcasticCount: z.number().int().min(0),
  toxicCount: z.number().int().min(0),
  mixedCount: z.number().int().min(0),
  sentimentOverTime: z.array(TimePointSchema),
  topKeywords: z.array(KeywordStatSchema),
  aspectStats: z.array(AspectStatSchema),
  emotionDistribution: z.array(EmotionStatSchema),
  languageDistribution: z.array(LanguageStatSchema),
});
export type AnalysisStats = z.infer<typeof AnalysisStatsSchema>;

// ─── AI Insight ────────────────────────────────────────────────────────────

export const RiskLevelSchema = z.enum(['low', 'medium', 'high']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const AnalysisInsightSchema = z.object({
  summary: z.string(),
  topPraise: z.array(z.string()),
  topComplaints: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  riskLevel: RiskLevelSchema,
  riskReason: z.string(),
  isTemplate: z.boolean().default(false),
});
export type AnalysisInsight = z.infer<typeof AnalysisInsightSchema>;

// ─── Analysis Progress ─────────────────────────────────────────────────────

export const AnalysisProgressSchema = z.object({
  stage: AnalysisStageSchema,
  fetched: z.number().int().min(0),
  analyzed: z.number().int().min(0),
  total: z.number().int().min(0),
});
export type AnalysisProgress = z.infer<typeof AnalysisProgressSchema>;

// ─── Full Analysis ─────────────────────────────────────────────────────────

export const AnalysisSchema = z.object({
  id: z.string(),
  videoId: z.string(),
  url: z.string().url(),
  videoMeta: VideoMetaSchema.nullable(),
  options: AnalysisOptionsSchema,
  status: AnalysisStatusSchema,
  stage: AnalysisStageSchema,
  progress: AnalysisProgressSchema,
  stats: AnalysisStatsSchema.nullable(),
  insight: AnalysisInsightSchema.nullable(),
  errors: z.array(z.string()),
  demo: z.boolean(),
  usedFallback: z.boolean(),
  createdAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

// ─── API Requests ──────────────────────────────────────────────────────────

export const CreateAnalysisRequestSchema = z.object({
  url: z.string().min(1, 'URL is required').max(500),
  options: AnalysisOptionsSchema.optional(),
});
export type CreateAnalysisRequest = z.infer<typeof CreateAnalysisRequestSchema>;

export const ListCommentsQuerySchema = z.object({
  sentiment: SentimentSchema.optional(),
  language: LanguageSchema.optional(),
  sarcastic: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  toxic: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  aspect: z.string().optional(),
  q: z.string().max(200).optional(),
  sort: z.enum(['likeCount', 'publishedAt', 'score', '-likeCount', '-publishedAt', '-score']).optional().default('-likeCount'),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(v ? parseInt(v, 10) : 20, 100)),
});
export type ListCommentsQuery = z.infer<typeof ListCommentsQuerySchema>;

export const ListAnalysesQuerySchema = z.object({
  q: z.string().max(200).optional(),
  status: AnalysisStatusSchema.optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(v ? parseInt(v, 10) : 10, 50)),
  sort: z.enum(['createdAt', '-createdAt']).optional().default('-createdAt'),
});
export type ListAnalysesQuery = z.infer<typeof ListAnalysesQuerySchema>;

// ─── API Responses ─────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ─── SSE Event Types ───────────────────────────────────────────────────────

export const SSEEventTypeSchema = z.enum([
  'progress',
  'partial_stats',
  'done',
  'error',
  'cancelled',
]);
export type SSEEventType = z.infer<typeof SSEEventTypeSchema>;

export const SSEEventSchema = z.object({
  type: SSEEventTypeSchema,
  analysisId: z.string(),
  data: z.unknown(),
});
export type SSEEvent = z.infer<typeof SSEEventSchema>;

// ─── Compare ──────────────────────────────────────────────────────────────

export const CompareResultSchema = z.object({
  a: AnalysisSchema,
  b: AnalysisSchema,
  delta: z.object({
    averageScore: z.number(),
    positivePercent: z.number(),
    negativePercent: z.number(),
    neutralPercent: z.number(),
    sarcasticCount: z.number(),
    toxicCount: z.number(),
    totalAnalyzed: z.number(),
  }),
});
export type CompareResult = z.infer<typeof CompareResultSchema>;
