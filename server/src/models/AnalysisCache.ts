import mongoose, { Schema, Document, Model } from 'mongoose';
import type { CommentAnalysis } from '@social-pulse/shared';

export interface IAnalysisCache extends Document {
  key: string;
  result: CommentAnalysis;
  createdAt: Date;
}

const analysisCacheSchema = new Schema<IAnalysisCache>(
  {
    key: { type: String, required: true, unique: true, index: true },
    result: { type: Schema.Types.Mixed, required: true },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
  }
);

// TTL index: cache expires after 30 days
analysisCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const AnalysisCache: Model<IAnalysisCache> = mongoose.model<IAnalysisCache>(
  'AnalysisCache',
  analysisCacheSchema
);
