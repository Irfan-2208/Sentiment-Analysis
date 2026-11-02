import type { SourceAdapter, SourceInput, FetchOptions, RawItem } from './types.js';
import type { VideoMeta } from '@social-pulse/shared';
import { extractVideoId } from '../youtube/urlParser.js';
import { fetchVideoMeta } from '../youtube/videoMeta.js';
import { fetchComments } from '../youtube/commentFetcher.js';
import { getDemoVideoMeta, getDemoComments } from '../youtube/demoData.js';
import { config } from '../../config/index.js';
import { AppError } from '../../utils/errors.js';

export class YouTubeAdapter implements SourceAdapter<SourceInput> {
  readonly id = 'youtube' as const;

  validateInput(input: SourceInput): SourceInput {
    if (!input.url && !input.videoId) {
      throw new AppError('INVALID_INPUT', 'YouTube URL or videoId is required', 400);
    }
    const url = input.url || `https://www.youtube.com/watch?v=${input.videoId}`;
    const videoId = extractVideoId(url);
    return { ...input, url, videoId };
  }

  async fetchMeta(input: SourceInput): Promise<VideoMeta> {
    if (config.IS_DEMO) {
      return getDemoVideoMeta();
    }
    const videoId = input.videoId || (input.url ? extractVideoId(input.url) : 'dQw4w9WgXcQ');
    return fetchVideoMeta(videoId);
  }

  async fetchItems(
    input: SourceInput,
    opts: FetchOptions,
    onProgress?: (fetchedCount: number) => void
  ): Promise<RawItem[]> {
    if (config.IS_DEMO) {
      return getDemoComments(opts.maxItems);
    }
    const videoId = input.videoId || (input.url ? extractVideoId(input.url) : '');
    return fetchComments(videoId, {
      maxComments: opts.maxItems,
      order: opts.order ?? 'relevance',
      includeReplies: opts.includeReplies ?? true,
      onProgress,
    });
  }
}

