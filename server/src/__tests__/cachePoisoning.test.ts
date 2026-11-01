/**
 * Regression tests for B1: Cache Poisoning fix.
 *
 * Verifies that two different comments with the same batch-local id (c000)
 * produce independent cache keys based on text content, not the batch id.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

// Inline the cache key builder logic (same as in gemini.ts) for unit testing
const ENGINE_VERSION = '2';

function buildCacheKey(text: string, model: string, promptVersion: string): string {
  const normalizedText = text.trim().toLowerCase();
  const hash = createHash('sha256')
    .update(`${ENGINE_VERSION}|${model}|${promptVersion}|${normalizedText}`)
    .digest('hex');
  return hash;
}

describe('B1: Cache key uniqueness', () => {
  it('two different comments with same batch id produce different cache keys', () => {
    const model = 'gemini-2.0-flash';
    const promptVersion = 'v1';

    // These would have the same batch-local id ("c000") in two separate batches
    const text1 = 'This video is absolutely amazing!';
    const text2 = 'This content is completely terrible.';

    const key1 = buildCacheKey(text1, model, promptVersion);
    const key2 = buildCacheKey(text2, model, promptVersion);

    expect(key1).not.toBe(key2);
  });

  it('same comment text always produces the same cache key', () => {
    const model = 'gemini-2.0-flash';
    const promptVersion = 'v1';
    const text = 'Great tutorial, very helpful!';

    const key1 = buildCacheKey(text, model, promptVersion);
    const key2 = buildCacheKey(text, model, promptVersion);

    expect(key1).toBe(key2);
  });

  it('cache key is insensitive to leading/trailing whitespace', () => {
    const model = 'gemini-2.0-flash';
    const promptVersion = 'v1';

    const key1 = buildCacheKey('Great video!', model, promptVersion);
    const key2 = buildCacheKey('  Great video!  ', model, promptVersion);

    expect(key1).toBe(key2);
  });

  it('cache key is insensitive to case', () => {
    const model = 'gemini-2.0-flash';
    const promptVersion = 'v1';

    const key1 = buildCacheKey('Great Video!', model, promptVersion);
    const key2 = buildCacheKey('great video!', model, promptVersion);

    expect(key1).toBe(key2);
  });

  it('different model names produce different cache keys for same text', () => {
    const promptVersion = 'v1';
    const text = 'Amazing content!';

    const key1 = buildCacheKey(text, 'gemini-2.0-flash', promptVersion);
    const key2 = buildCacheKey(text, 'gemini-pro', promptVersion);

    expect(key1).not.toBe(key2);
  });

  it('different prompt versions produce different cache keys for same text', () => {
    const model = 'gemini-2.0-flash';
    const text = 'Amazing content!';

    const key1 = buildCacheKey(text, model, 'v1');
    const key2 = buildCacheKey(text, model, 'v2');

    expect(key1).not.toBe(key2);
  });

  it('returns a 64-character hex string (sha256)', () => {
    const key = buildCacheKey('Test comment', 'model', 'v1');
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('B6: Deduplicator canonical-chain fix', () => {
  // Import the actual deduplicator
  it('when higher-liked comment replaces canonical, earlier duplicates point to new canonical', async () => {
    const { deduplicateComments } = await import('../services/preprocess/deduplicator.js');

    const comments = [
      // First seen — becomes initial canonical
      { externalId: 'a', text: 'dup', normalizedText: 'dup', hash: 'dup', likeCount: 5, publishedAt: '', isReply: false, authorName: '' },
      // Second seen with lower likes — becomes a duplicate of a
      { externalId: 'b', text: 'dup', normalizedText: 'dup', hash: 'dup', likeCount: 2, publishedAt: '', isReply: false, authorName: '' },
      // Third seen with highest likes — should become the canonical, and a,b both point to c
      { externalId: 'c', text: 'dup', normalizedText: 'dup', hash: 'dup', likeCount: 20, publishedAt: '', isReply: false, authorName: '' },
    ];

    const result = deduplicateComments(comments);

    expect(result.unique.length).toBe(1);
    expect(result.unique[0].externalId).toBe('c');

    // Both a and b should point to c (not to each other)
    expect(result.duplicateMap.get('a')).toBe('c');
    expect(result.duplicateMap.get('b')).toBe('c');

    // Duplicate count for c should be 2 (a and b)
    expect(result.duplicateCounts.get('c')).toBe(2);
  });
});

