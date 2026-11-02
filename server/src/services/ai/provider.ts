import type { CommentAnalysis, Sentiment, Emotion, Language } from '@social-pulse/shared';

export interface BatchItem {
  id: string; // stable short ID e.g. "c001"
  text: string; // normalized text
  platform?: 'youtube' | 'flipkart';
  rating?: number;
}

export interface BatchResult {
  id: string;
  result: CommentAnalysis;
  source: 'llm' | 'ensemble' | 'fallback' | 'override';
  signals?: Record<string, unknown>;
  reasoning?: string;
  needsReview?: boolean;
  engineVersion?: string;
}

export interface AIProvider {
  readonly name: string;
  /**
   * Analyzes a batch of comments and returns per-comment results.
   * Must return exactly one result per input id.
   */
  analyzeBatch(items: BatchItem[], promptVersion: string): Promise<BatchResult[]>;

  /**
   * Generates an executive insight from aggregated stats + representative comments.
   */
  generateInsight(statsJson: string, representativeComments: string[]): Promise<{
    summary: string;
    topPraise: string[];
    topComplaints: string[];
    recommendedActions: string[];
    riskLevel: 'low' | 'medium' | 'high';
    riskReason: string;
  }>;

  /**
   * Checks if the provider is available (API key present and reachable).
   */
  isAvailable(): Promise<boolean>;
}

// Re-export types for convenience
export type { CommentAnalysis, Sentiment, Emotion, Language };
