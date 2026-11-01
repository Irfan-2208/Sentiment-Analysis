import demoCommentsRaw from '../../fixtures/demoComments.json';
import type { RawComment } from './commentFetcher.js';

interface DemoCommentEntry {
  id: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  isReply: boolean;
}

const DEMO_VIDEO_META = {
  videoId: 'dQw4w9WgXcQ',
  title: '(Demo) How to Build Amazing Products - Full Tutorial',
  channelTitle: 'Demo Channel',
  channelId: 'demo_channel_001',
  thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
  publishedAt: '2024-01-01T00:00:00Z',
  viewCount: 1250000,
  likeCount: 45000,
  commentCount: 3000,
  description: 'This is demo data. Real video would show actual YouTube metadata.',
};

/**
 * Returns demo video metadata for use when DEMO_MODE is active.
 */
export function getDemoVideoMeta() {
  return { ...DEMO_VIDEO_META };
}

/**
 * Returns up to `max` demo comments as RawComment objects.
 * Shuffles slightly to simulate variety on each analysis.
 */
export function getDemoComments(max = 300): RawComment[] {
  const entries = demoCommentsRaw as DemoCommentEntry[];
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, max).map((entry) => ({
    externalId: entry.id,
    text: entry.text,
    likeCount: entry.likeCount,
    publishedAt: entry.publishedAt,
    isReply: entry.isReply,
    authorName: 'Demo User',
  }));
}
