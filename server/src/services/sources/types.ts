import type { Platform, VideoMeta, ProductMeta, AnalysisOrder } from '@social-pulse/shared';

export interface RawItem {
  externalId: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  isReply: boolean;
  authorName: string;
  rating?: number;
  reviewTitle?: string;
}

export type SourceMeta = VideoMeta | ProductMeta;

export interface FetchOptions {
  maxItems: number;
  order?: AnalysisOrder;
  includeReplies?: boolean;
}

export interface SourceInput {
  url?: string;
  videoId?: string;
  pastedText?: string;
  rawReviews?: Array<{
    text: string;
    rating?: number;
    title?: string;
    date?: string;
    likes?: number;
    author?: string;
  }>;
  productMeta?: Partial<ProductMeta>;
  csvContent?: string;
}

export interface SourceAdapter<TInput extends SourceInput = SourceInput> {
  readonly id: Platform;
  validateInput(input: TInput): Promise<TInput> | TInput;
  fetchMeta(input: TInput): Promise<SourceMeta>;
  fetchItems(
    input: TInput,
    opts: FetchOptions,
    onProgress?: (fetchedCount: number) => void
  ): Promise<RawItem[]>;
}

