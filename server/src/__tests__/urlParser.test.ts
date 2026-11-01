import { describe, it, expect } from 'vitest';
import { extractVideoId } from '../services/youtube/urlParser.js';

describe('extractVideoId', () => {
  // ── Valid watch URLs ─────────────────────────────────────────────────────
  it('parses standard watch URL', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('parses watch URL without www', () => {
    expect(extractVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('parses watch URL with extra params', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=PLX')).toBe('dQw4w9WgXcQ');
  });
  it('parses watch URL with si param', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=abc1234DEFG&si=shared123')).toBe('abc1234DEFG');
  });

  // ── youtu.be short URLs ──────────────────────────────────────────────────
  it('parses youtu.be short URL', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('parses youtu.be URL with t param', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ?t=120')).toBe('dQw4w9WgXcQ');
  });
  it('parses youtu.be URL with si param', () => {
    expect(extractVideoId('https://youtu.be/abc1234DEFG?si=xyz')).toBe('abc1234DEFG');
  });

  // ── Shorts ───────────────────────────────────────────────────────────────
  it('parses /shorts/ URL', () => {
    expect(extractVideoId('https://www.youtube.com/shorts/abc1234DEFG')).toBe('abc1234DEFG');
  });
  it('parses /shorts/ URL with trailing slash', () => {
    expect(extractVideoId('https://youtube.com/shorts/abc1234DEFG/')).toBe('abc1234DEFG');
  });

  // ── Embed ────────────────────────────────────────────────────────────────
  it('parses /embed/ URL', () => {
    expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('parses /embed/ URL with autoplay param', () => {
    expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1')).toBe('dQw4w9WgXcQ');
  });

  // ── Live ─────────────────────────────────────────────────────────────────
  it('parses /live/ URL', () => {
    expect(extractVideoId('https://www.youtube.com/live/abc1234DEFG')).toBe('abc1234DEFG');
  });

  // ── /v/ format ───────────────────────────────────────────────────────────
  it('parses /v/ URL', () => {
    expect(extractVideoId('https://www.youtube.com/v/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  // ── Mobile URLs ──────────────────────────────────────────────────────────
  it('parses m.youtube.com watch URL', () => {
    expect(extractVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  // ── Without protocol ────────────────────────────────────────────────────
  it('handles URL without protocol (adds https)', () => {
    expect(extractVideoId('youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('handles youtu.be without protocol', () => {
    expect(extractVideoId('youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  // ── ID with hyphens and underscores (valid) ──────────────────────────────
  it('handles ID with hyphens', () => {
    expect(extractVideoId('https://youtu.be/abc-123_DEF')).toBe('abc-123_DEF');
  });

  // ── Invalid URLs ─────────────────────────────────────────────────────────
  it('throws for non-YouTube URL', () => {
    expect(() => extractVideoId('https://vimeo.com/123456')).toThrow();
  });
  it('throws for empty string', () => {
    expect(() => extractVideoId('')).toThrow();
  });
  it('throws for random string', () => {
    expect(() => extractVideoId('not a url')).toThrow();
  });
  it('throws for channel URL (no video)', () => {
    expect(() => extractVideoId('https://www.youtube.com/channel/UCxxxxxx')).toThrow();
  });
  it('throws for playlist URL without v param', () => {
    expect(() => extractVideoId('https://www.youtube.com/playlist?list=PLxxx')).toThrow();
  });
  it('throws for too-short video ID', () => {
    expect(() => extractVideoId('https://youtu.be/short')).toThrow();
  });
  it('throws for too-long video ID', () => {
    expect(() => extractVideoId('https://youtu.be/toolongvideoid123')).toThrow();
  });
  it('throws for search URL', () => {
    expect(() => extractVideoId('https://www.youtube.com/results?search_query=test')).toThrow();
  });
  it('throws for user profile URL', () => {
    expect(() => extractVideoId('https://www.youtube.com/@ChannelName')).toThrow();
  });
  it('throws for null-like input', () => {
    // @ts-expect-error — testing runtime guard
    expect(() => extractVideoId(null)).toThrow();
  });

  // ── SSRF safety ──────────────────────────────────────────────────────────
  it('throws for internal IP URL', () => {
    expect(() => extractVideoId('http://192.168.1.1/watch?v=dQw4w9WgXcQ')).toThrow();
  });
  it('throws for localhost URL', () => {
    expect(() => extractVideoId('http://localhost/watch?v=dQw4w9WgXcQ')).toThrow();
  });
  it('extracts correct ID from complex URL with many params', () => {
    expect(
      extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=youtu.be&t=30&ab_channel=Test')
    ).toBe('dQw4w9WgXcQ');
  });
});
