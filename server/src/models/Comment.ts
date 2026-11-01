import mongoose, { Schema, Document, Model } from 'mongoose';
import type { Sentiment, Emotion, Language, AspectSentiment, AnalysisSource, Signals } from '@social-pulse/shared';

export interface IComment extends Document {
  _id: mongoose.Types.ObjectId;
  analysisId: mongoose.Types.ObjectId;
  externalId: string;
  text: string;
  normalizedText: string;
  hash: string;
  likeCount: number;
  publishedAt: string | null;
  isReply: boolean;
  isDuplicateOf: string | null;
  duplicateCount: number;
  isSpam: boolean;
  analysis: {
    sentiment: Sentiment;
    score: number;
    confidence: number;
    emotion: Emotion;
    language: Language;
    isSarcastic: boolean;
    isMixed: boolean;
    aspects: AspectSentiment[];
    keywords: string[];
    isToxic: boolean;
  } | null;
  source: AnalysisSource | null;
  signals?: Signals | null;
  reasoning?: string | null;
  needsReview?: boolean;
  engineVersion?: string | null;
  userOverride: {
    sentiment: Sentiment;
    overriddenAt: Date;
  } | null;
  createdAt: Date;
}

const commentAnalysisSchema = new Schema(
  {
    sentiment: { type: String, enum: ['positive', 'negative', 'neutral'] },
    score: Number,
    confidence: Number,
    emotion: { type: String, enum: ['joy', 'anger', 'sadness', 'fear', 'surprise', 'disgust', 'trust', 'anticipation', 'none'] },
    language: { type: String, enum: ['en', 'hi', 'hinglish', 'other'] },
    isSarcastic: Boolean,
    isMixed: Boolean,
    aspects: [{ aspect: String, sentiment: String, _id: false }],
    keywords: [String],
    isToxic: Boolean,
  },
  { _id: false }
);

const commentSchema = new Schema<IComment>(
  {
    analysisId: { type: Schema.Types.ObjectId, required: true, ref: 'Analysis', index: true },
    externalId: { type: String, required: true },
    text: { type: String, required: true },
    normalizedText: { type: String, required: true },
    hash: { type: String, required: true, index: true },
    likeCount: { type: Number, default: 0 },
    publishedAt: { type: String, default: null },
    isReply: { type: Boolean, default: false },
    isDuplicateOf: { type: String, default: null },
    duplicateCount: { type: Number, default: 0 },
    isSpam: { type: Boolean, default: false },
    analysis: { type: commentAnalysisSchema, default: null },
    source: { type: String, enum: ['llm', 'ensemble', 'fallback', 'override', null], default: null },
    signals: { type: Schema.Types.Mixed, default: null },
    reasoning: { type: String, default: null },
    needsReview: { type: Boolean, default: false },
    engineVersion: { type: String, default: null },
    userOverride: {
      type: {
        sentiment: String,
        overriddenAt: Date,
      },
      default: null,
      _id: false,
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// Compound indexes for efficient comment queries
commentSchema.index({ analysisId: 1, isSpam: 1, isDuplicateOf: 1 });
commentSchema.index({ analysisId: 1, 'analysis.sentiment': 1 });
commentSchema.index({ analysisId: 1, 'analysis.language': 1 });
commentSchema.index({ analysisId: 1, likeCount: -1 });

export const Comment: Model<IComment> = mongoose.model<IComment>('Comment', commentSchema);
