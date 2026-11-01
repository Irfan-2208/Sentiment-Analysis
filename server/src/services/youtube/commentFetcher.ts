import { google } from 'googleapis';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { YouTubeError } from '../../utils/errors.js';
import type { AnalysisOrder } from '@social-pulse/shared';

export interface RawComment {
  externalId: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  isReply: boolean;
  authorName: string;
}

const youtube = google.youtube({ version: 'v3', auth: config.YOUTUBE_API_KEY });

/**
 * Fetches comments from YouTube with pagination.
 * - textFormat: plainText (avoids HTML entities in comment text)
 * - Privacy: stores authorName only, drops profile photos and channel IDs
 */
export async function fetchComments(
  videoId: string,
  options: {
    maxComments: number;
    order: AnalysisOrder;
    includeReplies: boolean;
    onProgress?: (fetched: number) => void;
  }
): Promise<RawComment[]> {
  const { maxComments, order, includeReplies, onProgress } = options;
  const comments: RawComment[] = [];
  let pageToken: string | undefined;
  const maxLimit = config.MAX_COMMENTS_LIMIT > 0 ? config.MAX_COMMENTS_LIMIT : 100000;
  // If maxComments <= 0, user wants all comments on the video (capped only by system ceiling)
  const cap = maxComments > 0 ? Math.min(maxComments, maxLimit) : maxLimit;

  logger.info({ videoId, maxComments: cap, isUnlimited: maxComments <= 0, order, includeReplies }, 'Starting comment fetch');

  do {
    let response;
    try {
      response = await youtube.commentThreads.list({
        part: includeReplies ? ['snippet', 'replies'] : ['snippet'],
        videoId,
        maxResults: 100,
        order,
        textFormat: 'plainText',
        ...(pageToken ? { pageToken } : {}),
      });
    } catch (err: unknown) {
      const apiErr = err as { code?: number; errors?: Array<{ reason?: string; domain?: string }> };
      const reason = apiErr?.errors?.[0]?.reason ?? '';
      const domain = apiErr?.errors?.[0]?.domain ?? '';

      if (apiErr?.code === 403 && reason === 'quotaExceeded') {
        throw new YouTubeError('YOUTUBE_QUOTA_EXCEEDED', 'YouTube API quota exceeded');
      }
      if (apiErr?.code === 403 && (reason === 'commentsDisabled' || domain === 'youtube.quota')) {
        throw new YouTubeError('YOUTUBE_COMMENTS_DISABLED', `Comments are disabled on video ${videoId}`);
      }
      if (apiErr?.code === 403) {
        // Generic 403 might still be comments disabled
        throw new YouTubeError('YOUTUBE_COMMENTS_DISABLED', `Comments cannot be accessed for video ${videoId}`);
      }
      throw new YouTubeError('YOUTUBE_INVALID_KEY', `YouTube API error: ${String(err)}`);
    }

    const items = response.data.items ?? [];

    for (const thread of items) {
      if (comments.length >= cap) break;

      const top = thread.snippet?.topLevelComment?.snippet;
      if (!top) continue;

      comments.push({
        externalId: thread.id ?? '',
        text: top.textDisplay ?? '',
        likeCount: Number(top.likeCount ?? 0),
        publishedAt: top.publishedAt ?? new Date().toISOString(),
        isReply: false,
        authorName: top.authorDisplayName ?? 'Anonymous',
      });

      // Include replies if requested
      if (includeReplies) {
        if (thread.replies?.comments) {
          for (const reply of thread.replies.comments) {
            if (comments.length >= cap) break;
            const rs = reply.snippet;
            if (!rs) continue;
            comments.push({
              externalId: reply.id ?? '',
              text: rs.textDisplay ?? '',
              likeCount: Number(rs.likeCount ?? 0),
              publishedAt: rs.publishedAt ?? new Date().toISOString(),
              isReply: true,
              authorName: rs.authorDisplayName ?? 'Anonymous',
            });
          }
        }

        // If thread has additional replies beyond the initial inline comments,
        // fetch remaining replies using youtube.comments.list
        const totalReplies = Number(thread.snippet?.totalReplyCount ?? 0);
        const inlineCount = thread.replies?.comments?.length ?? 0;
        if (totalReplies > inlineCount && comments.length < cap) {
          try {
            let replyPageToken: string | undefined;
            do {
              const replyRes = await youtube.comments.list({
                part: ['snippet'],
                parentId: thread.id ?? '',
                maxResults: 100,
                textFormat: 'plainText',
                ...(replyPageToken ? { pageToken: replyPageToken } : {}),
              });
              const replyItems = replyRes.data.items ?? [];
              for (const rItem of replyItems) {
                if (comments.length >= cap) break;
                // Avoid duplicating the inline comments
                if (thread.replies?.comments?.some((c) => c.id === rItem.id)) continue;
                const rs = rItem.snippet;
                if (!rs) continue;
                comments.push({
                  externalId: rItem.id ?? '',
                  text: rs.textDisplay ?? '',
                  likeCount: Number(rs.likeCount ?? 0),
                  publishedAt: rs.publishedAt ?? new Date().toISOString(),
                  isReply: true,
                  authorName: rs.authorDisplayName ?? 'Anonymous',
                });
              }
              replyPageToken = replyRes.data.nextPageToken ?? undefined;
            } while (replyPageToken && comments.length < cap);
          } catch {
            // Non-fatal if fetching extra replies encounters quota or errors
          }
        }
      }
    }

    onProgress?.(comments.length);
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken && comments.length < cap);

  logger.info({ videoId, fetched: comments.length }, 'Comment fetch complete');
  return comments.slice(0, cap);
}
