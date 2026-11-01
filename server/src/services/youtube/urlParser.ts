import { YouTubeError } from '../../utils/errors.js';

// Valid YouTube video ID: exactly 11 characters, alphanumeric + hyphen + underscore
const VIDEO_ID_REGEX = /^[\w-]{11}$/;

/**
 * Extracts a YouTube video ID from any supported URL format.
 * Supported: watch, youtu.be, shorts, embed, live, mobile (m.youtube.com).
 * SSRF-safe: only returns a validated 11-char ID, never fetches arbitrary URLs.
 */
export function extractVideoId(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new YouTubeError('YOUTUBE_INVALID_URL', 'URL must be a non-empty string');
  }

  const url = rawUrl.trim();

  // Try parsing as a URL
  let parsed: URL;
  try {
    // Handle protocol-relative or bare URLs
    const withProtocol = url.startsWith('http') ? url : `https://${url}`;
    parsed = new URL(withProtocol);
  } catch {
    throw new YouTubeError('YOUTUBE_INVALID_URL', `Cannot parse URL: ${url}`);
  }

  const hostname = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');

  let videoId: string | null = null;

  // ── youtu.be/<id> ──────────────────────────────────────────────
  if (hostname === 'youtu.be') {
    videoId = parsed.pathname.slice(1).split('?')[0].split('/')[0];
  }

  // ── youtube.com/<path> ─────────────────────────────────────────
  else if (hostname === 'youtube.com') {
    const path = parsed.pathname;

    // /watch?v=<id>
    if (path === '/watch' || path.startsWith('/watch/')) {
      videoId = parsed.searchParams.get('v');
    }
    // /shorts/<id>
    else if (path.startsWith('/shorts/')) {
      videoId = path.split('/shorts/')[1]?.split('?')[0].split('/')[0] ?? null;
    }
    // /embed/<id>
    else if (path.startsWith('/embed/')) {
      videoId = path.split('/embed/')[1]?.split('?')[0].split('/')[0] ?? null;
    }
    // /live/<id>
    else if (path.startsWith('/live/')) {
      videoId = path.split('/live/')[1]?.split('?')[0].split('/')[0] ?? null;
    }
    // /v/<id>
    else if (path.startsWith('/v/')) {
      videoId = path.split('/v/')[1]?.split('?')[0].split('/')[0] ?? null;
    }
    // /e/<id>
    else if (path.startsWith('/e/')) {
      videoId = path.split('/e/')[1]?.split('?')[0].split('/')[0] ?? null;
    }
  }

  if (!videoId || !VIDEO_ID_REGEX.test(videoId)) {
    throw new YouTubeError(
      'YOUTUBE_INVALID_URL',
      `Could not extract a valid video ID from: ${url}. Supported formats: watch, youtu.be, shorts, embed, live.`
    );
  }

  return videoId;
}

/**
 * Validates that a string is a proper YouTube video ID.
 */
export function isValidVideoId(id: string): boolean {
  return VIDEO_ID_REGEX.test(id);
}
