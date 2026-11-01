import { describe, it, expect } from 'vitest';
import { normalizeText, preprocessComments } from '../services/preprocess/normalizer.js';
import { deduplicateComments } from '../services/preprocess/deduplicator.js';
import { isSpam } from '../services/preprocess/spamDetector.js';

describe('normalizeText', () => {
  it('strips HTML tags', () => {
    expect(normalizeText('<b>Hello</b> world')).toBe('Hello world');
  });
  it('decodes HTML entities', () => {
    expect(normalizeText('Hello &amp; World &lt;3&gt;')).toBe('Hello & World <3>');
  });
  it('collapses multiple spaces', () => {
    expect(normalizeText('Hello   World')).toBe('Hello World');
  });
  it('preserves emojis', () => {
    const text = 'Great video 🔥🎉';
    expect(normalizeText(text)).toContain('🔥');
    expect(normalizeText(text)).toContain('🎉');
  });
  it('handles empty string', () => {
    expect(normalizeText('')).toBe('');
  });
  it('NFKC normalizes unicode', () => {
    // Full-width characters → ASCII
    expect(normalizeText('ｈｅｌｌｏ')).toBe('hello');
  });
  it('preserves original casing', () => {
    expect(normalizeText('Hello WORLD')).toBe('Hello WORLD');
  });
  it('trims whitespace', () => {
    expect(normalizeText('  hello world  ')).toBe('hello world');
  });
});

describe('deduplicateComments', () => {
  it('keeps unique comments', () => {
    const comments = [
      { externalId: 'a', text: 'hello', normalizedText: 'hello', hash: 'h1', likeCount: 5, publishedAt: '', isReply: false, authorName: '' },
      { externalId: 'b', text: 'world', normalizedText: 'world', hash: 'h2', likeCount: 3, publishedAt: '', isReply: false, authorName: '' },
    ];
    const result = deduplicateComments(comments);
    expect(result.unique.length).toBe(2);
    expect(result.duplicateMap.size).toBe(0);
  });

  it('deduplicates by hash, keeping higher like count', () => {
    const comments = [
      { externalId: 'a', text: 'hello', normalizedText: 'hello', hash: 'same', likeCount: 5, publishedAt: '', isReply: false, authorName: '' },
      { externalId: 'b', text: 'hello', normalizedText: 'hello', hash: 'same', likeCount: 20, publishedAt: '', isReply: false, authorName: '' },
    ];
    const result = deduplicateComments(comments);
    expect(result.unique.length).toBe(1);
    expect(result.unique[0].externalId).toBe('b');
    expect(result.duplicateMap.get('a')).toBe('b');
  });

  it('tracks duplicate count', () => {
    const comments = [
      { externalId: 'a', text: 'dup', normalizedText: 'dup', hash: 'dup', likeCount: 10, publishedAt: '', isReply: false, authorName: '' },
      { externalId: 'b', text: 'dup', normalizedText: 'dup', hash: 'dup', likeCount: 5, publishedAt: '', isReply: false, authorName: '' },
      { externalId: 'c', text: 'dup', normalizedText: 'dup', hash: 'dup', likeCount: 1, publishedAt: '', isReply: false, authorName: '' },
    ];
    const result = deduplicateComments(comments);
    expect(result.unique.length).toBe(1);
    expect(result.duplicateCounts.get('a')).toBeGreaterThanOrEqual(1);
  });
});

describe('isSpam', () => {
  it('flags URL-containing comment as spam', () => {
    expect(isSpam('Check out www.mysite.com for free stuff')).toBe(true);
    expect(isSpam('Visit https://spam.link/promo now!')).toBe(true);
  });

  it('flags sub4sub comment as spam', () => {
    expect(isSpam('sub 4 sub anyone? I sub back')).toBe(true);
    expect(isSpam('sub for sub please!')).toBe(true);
  });

  it('flags promotional language as spam', () => {
    expect(isSpam('FREE subscribers! Check my channel!')).toBe(true);
    expect(isSpam('Make money online!! Click link in bio!!')).toBe(true);
  });

  it('flags excessive repetition as spam', () => {
    expect(isSpam('aaaaaaaaaaaaa')).toBe(true); // 13 identical chars — clearly a keyboard smash
  });

  it('does NOT flag legitimate short emoji comments', () => {
    expect(isSpam('❤️')).toBe(false);
    expect(isSpam('🔥🔥🔥')).toBe(false);
  });

  it('does NOT flag short sentiment words (B5 fix)', () => {
    // These were incorrectly flagged by the old < 4 char rule
    expect(isSpam('ok')).toBe(false);
    expect(isSpam('wow')).toBe(false);
    expect(isSpam('meh')).toBe(false);
    expect(isSpam('वाह')).toBe(false);
    expect(isSpam('👍')).toBe(false);
    expect(isSpam('k')).toBe(false);
    expect(isSpam('.')).toBe(false);
  });

  it('does NOT flag elongated words (B5 fix: elongation = intensity signal)', () => {
    expect(isSpam('soooooo good')).toBe(false);   // 6 repeated chars < 10
    expect(isSpam('bhaaaai')).toBe(false);
    expect(isSpam('!!!!!!')).toBe(false);          // valid excitement punctuation
  });

  it('does NOT flag legitimate negative comments', () => {
    expect(isSpam('This video is terrible and waste of time')).toBe(false);
  });

  it('does NOT flag legitimate positive comments', () => {
    expect(isSpam('Amazing content! This is so helpful!')).toBe(false);
  });

  it('does NOT flag Hinglish comments', () => {
    expect(isSpam('Bahut achha video hai bhai!')).toBe(false);
  });
});

describe('preprocessComments', () => {
  it('generates hash and normalized text for each comment', () => {
    const raw = [
      { externalId: 'x1', text: '<b>Hello</b> &amp; World', likeCount: 10, publishedAt: '2024-01-01T00:00:00Z', isReply: false, authorName: 'Test' },
    ];
    const result = preprocessComments(raw);
    expect(result.length).toBe(1);
    expect(result[0].normalizedText).toBe('Hello & World');
    expect(result[0].hash).toBeTruthy();
    expect(result[0].text).toBe(raw[0].text); // original preserved
  });
});
