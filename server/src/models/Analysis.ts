import mongoose, { Schema, Document, Model } from 'mongoose';
import type {
  Platform,
  AnalysisStatus,
  AnalysisStage,
  AnalysisOptions,
  VideoMeta,
  ProductMeta,
  AnalysisStats,
  AnalysisInsight,
  AnalysisProgress,
} from '@social-pulse/shared';

export interface IAnalysis extends Document {
  _id: mongoose.Types.ObjectId;
  platform: Platform;
  videoId: string;
  url: string;
  videoMeta: VideoMeta | null;
  productMeta: ProductMeta | null;
  options: AnalysisOptions;
  status: AnalysisStatus;
  stage: AnalysisStage;
  progress: AnalysisProgress;
  stats: AnalysisStats | null;
  insight: AnalysisInsight | null;
  jobErrors: string[];
  demo: boolean;
  usedFallback: boolean;
  createdAt: Date;
  finishedAt: Date | null;
}

const videoMetaSchema = new Schema(
  {
    videoId: String,
    title: String,
    channelTitle: String,
    channelId: String,
    thumbnailUrl: String,
    publishedAt: String,
    viewCount: Number,
    likeCount: Number,
    commentCount: Number,
    description: String,
  },
  { _id: false }
);

const productMetaSchema = new Schema(
  {
    productId: String,
    title: String,
    price: Number,
    rating: Number,
    ratingCount: Number,
    reviewCount: Number,
    thumbnailUrl: String,
    productUrl: String,
    brand: String,
    source: String,
  },
  { _id: false }
);

const aspectSentimentSchema = new Schema(
  {
    aspect: String,
    sentiment: String,
  },
  { _id: false }
);

const sentimentCountsSchema = new Schema(
  {
    positive: { type: Number, default: 0 },
    negative: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 },
  },
  { _id: false }
);

const analysisStatsSchema = new Schema(
  {
    totalFetched: Number,
    totalDeduplicated: Number,
    totalSpamRemoved: Number,
    totalAnalyzed: Number,
    totalFallback: Number,
    sentimentCounts: sentimentCountsSchema,
    sentimentPercentages: sentimentCountsSchema,
    averageScore: Number,
    sarcasticCount: Number,
    toxicCount: Number,
    mixedCount: Number,
    sentimentOverTime: [Schema.Types.Mixed],
    topKeywords: [Schema.Types.Mixed],
    aspectStats: [Schema.Types.Mixed],
    emotionDistribution: [Schema.Types.Mixed],
    languageDistribution: [Schema.Types.Mixed],
    ratingDistribution: { type: Schema.Types.Mixed, default: null },
    ratingMismatchCount: { type: Number, default: 0 },
    topPros: { type: [String], default: [] },
    topCons: { type: [String], default: [] },
    aspectRatingStats: [Schema.Types.Mixed],
  },
  { _id: false }
);

const insightSchema = new Schema(
  {
    summary: String,
    topPraise: [String],
    topComplaints: [String],
    recommendedActions: [String],
    riskLevel: String,
    riskReason: String,
    isTemplate: { type: Boolean, default: false },
  },
  { _id: false }
);

const progressSchema = new Schema(
  {
    stage: String,
    fetched: { type: Number, default: 0 },
    analyzed: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const analysisSchema = new Schema<IAnalysis>(
  {
    platform: { type: String, enum: ['youtube', 'flipkart'], default: 'youtube', index: true },
    videoId: { type: String, required: true, index: true },
    url: { type: String, required: true },
    videoMeta: { type: videoMetaSchema, default: null },
    productMeta: { type: productMetaSchema, default: null },
    options: {
      type: {
        maxComments: Number,
        order: String,
        includeReplies: Boolean,
        provider: String,
        model: String,
        promptVersion: String,
      },
      _id: false,
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'done', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    stage: {
      type: String,
      enum: ['validating', 'fetching', 'preprocessing', 'analyzing', 'aggregating', 'done', 'failed'],
      default: 'validating',
    },
    progress: { type: progressSchema, default: () => ({ stage: 'validating', fetched: 0, analyzed: 0, total: 0 }) },
    stats: { type: analysisStatsSchema, default: null },
    insight: { type: insightSchema, default: null },
    jobErrors: { type: [String], default: [] },
    demo: { type: Boolean, default: false },
    usedFallback: { type: Boolean, default: false },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false }, suppressReservedKeysWarning: true }
);

analysisSchema.index({ createdAt: -1 });
analysisSchema.index({ status: 1, createdAt: -1 });

export const Analysis: Model<IAnalysis> = mongoose.model<IAnalysis>('Analysis', analysisSchema);
