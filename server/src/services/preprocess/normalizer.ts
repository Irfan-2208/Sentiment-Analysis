import crypto from 'crypto';

/**
 * Normalizes comment text:
 * 1. Unicode NFKC normalize (handles full-width chars, ligatures, etc.)
 * 2. Strip HTML tags and common HTML entities
 * 3. Collapse whitespace (keep newlines → space)
 * Preserves: emojis, original casing, punctuation
 * Does NOT strip negations or stopwords.
 */
export function normalizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // 1. NFKC Unicode normalization
  let normalized = text.normalize('NFKC');

  // 2. Strip HTML tags (YouTube textFormat=plainText still occasionally has some)
  normalized = normalized.replace(/<[^>]+>/g, ' ');

  // 3. Decode common HTML entities
  normalized = normalized
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

  // 4. Collapse multiple whitespace (but preserve emojis and casing)
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Generates a stable SHA-256 hash of normalized text for deduplication.
 */
export function hashText(normalizedText: string): string {
  return crypto.createHash('sha256').update(normalizedText.toLowerCase().trim()).digest('hex');
}

export interface ProcessedComment {
  externalId: string;
  text: string; // original
  normalizedText: string;
  hash: string;
  likeCount: number;
  publishedAt: string;
  isReply: boolean;
  authorName: string;
}

export function preprocessComments(
  rawComments: Array<{
    externalId: string;
    text: string;
    likeCount: number;
    publishedAt: string;
    isReply: boolean;
    authorName: string;
  }>
): ProcessedComment[] {
  return rawComments.map((raw) => {
    const normalizedText = normalizeText(raw.text);
    return {
      externalId: raw.externalId,
      text: raw.text,
      normalizedText,
      hash: hashText(normalizedText),
      likeCount: raw.likeCount,
      publishedAt: raw.publishedAt,
      isReply: raw.isReply,
      authorName: raw.authorName,
    };
  });
}
