import { google } from 'googleapis';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { YouTubeError } from '../../utils/errors.js';
import type { VideoMeta } from '@social-pulse/shared';

const youtube = google.youtube({ version: 'v3', auth: config.YOUTUBE_API_KEY });

/**
 * Fetches video metadata from YouTube Data API v3 videos.list.
 * Maps all known error conditions to typed YouTubeError instances.
 */
export async function fetchVideoMeta(videoId: string): Promise<VideoMeta> {
  logger.debug({ videoId }, 'Fetching video metadata');

  let response;
  try {
    response = await youtube.videos.list({
      part: ['snippet', 'statistics', 'status'],
      id: [videoId],
    });
  } catch (err: unknown) {
    const apiErr = err as { code?: number; errors?: Array<{ reason?: string }> };
    const reason = apiErr?.errors?.[0]?.reason ?? '';

    if (apiErr?.code === 403 && reason === 'quotaExceeded') {
      throw new YouTubeError('YOUTUBE_QUOTA_EXCEEDED', 'YouTube API quota exceeded');
    }
    if (apiErr?.code === 400 || apiErr?.code === 403) {
      throw new YouTubeError('YOUTUBE_INVALID_KEY', 'YouTube API key is invalid or missing');
    }
    throw new YouTubeError('YOUTUBE_INVALID_KEY', `YouTube API error: ${String(err)}`);
  }

  const items = response.data.items;
  if (!items || items.length === 0) {
    throw new YouTubeError('YOUTUBE_VIDEO_NOT_FOUND', `Video ${videoId} not found`);
  }

  const video = items[0];
  const snippet = video.snippet!;
  const stats = video.statistics!;
  const status = video.status!;

  // Check if video is private
  if (status.privacyStatus === 'private') {
    throw new YouTubeError('YOUTUBE_VIDEO_PRIVATE', `Video ${videoId} is private`);
  }

  // Check if comments are disabled
  if (status.madeForKids || snippet.liveBroadcastContent === 'upcoming') {
    // Note: madeForKids can disable comments; the actual check happens at commentThreads.list
  }

  const meta: VideoMeta = {
    videoId,
    title: snippet.title ?? 'Unknown Title',
    channelTitle: snippet.channelTitle ?? 'Unknown Channel',
    channelId: snippet.channelId ?? '',
    thumbnailUrl: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? undefined,
    publishedAt: snippet.publishedAt ?? new Date().toISOString(),
    viewCount: parseInt(stats.viewCount ?? '0', 10),
    likeCount: parseInt(stats.likeCount ?? '0', 10),
    commentCount: parseInt(stats.commentCount ?? '0', 10),
    description: (snippet.description ?? '').slice(0, 500),
  };

  logger.info({ videoId, title: meta.title }, 'Video metadata fetched');
  return meta;
}
