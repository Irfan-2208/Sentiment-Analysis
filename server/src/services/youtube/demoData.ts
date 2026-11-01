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
 * If max is 0 (all), returns all available demo comments.
 * If max is larger than available fixtures, cycles with unique IDs to test high-volume analysis.
 */
export function getDemoComments(max = 0): RawComment[] {
  const entries = demoCommentsRaw as DemoCommentEntry[];
  const target = max <= 0 ? entries.length : max;

  if (target <= entries.length) {
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, target).map((entry, idx) => ({
      externalId: `${entry.id}-${idx}`,
      text: entry.text,
      likeCount: entry.likeCount,
      publishedAt: entry.publishedAt,
      isReply: entry.isReply,
      authorName: 'Demo User',
    }));
  }

  // Synthesize up to target (e.g. 1000 or 10000) for testing large volume in demo mode
  const result: RawComment[] = [];
  for (let i = 0; i < target; i++) {
    const template = entries[i % entries.length];
    result.push({
      externalId: `demo-${i}-${template.id}`,
      text: template.text,
      likeCount: template.likeCount,
      publishedAt: template.publishedAt,
      isReply: template.isReply,
      authorName: `Demo User ${i + 1}`,
    });
  }
  return result;
}
