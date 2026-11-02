import { z } from 'zod';
import { createHash } from 'crypto';
import type { SourceAdapter, SourceInput, FetchOptions, RawItem } from './types.js';
import type { ProductMeta } from '@social-pulse/shared';
import { parseFlipkartUrl } from './flipkartUrlParser.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import demoReviewsRaw from '../../fixtures/demoReviews.json';

const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 5000;

export const ParsedReviewRowSchema = z.object({
  text: z.string().min(1, 'Review text cannot be empty'),
  rating: z.number().min(1).max(5).optional(),
  title: z.string().optional(),
  date: z.string().optional(),
  likes: z.number().int().min(0).optional(),
  author: z.string().optional(),
});
export type ParsedReviewRow = z.infer<typeof ParsedReviewRowSchema>;

/**
 * Strips UTF-8 BOM if present (\uFEFF)
 */
export function stripBOM(str: string): string {
  if (str.charCodeAt(0) === 0xfeff) {
    return str.slice(1);
  }
  return str;
}

/**
 * RFC 4180 compliant CSV line tokenizer that handles multi-line quoted fields,
 * escaped quotes (""), and varied delimiters.
 */
export function parseCSV(content: string): string[][] {
  const clean = stripBOM(content);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++; // Handle CRLF
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows.filter((r) => r.some((field) => field.length > 0));
}

/**
 * Normalizes header names for flexible matching
 */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Column header matcher mappings
 */
const TEXT_COLUMNS = ['review', 'reviewtext', 'text', 'comment', 'feedback', 'body', 'content', 'description', 'customerreview'];
const RATING_COLUMNS = ['rating', 'stars', 'star', 'score', 'overallrating', 'starrating', 'ratings'];
const TITLE_COLUMNS = ['title', 'headline', 'summary', 'reviewtitle', 'heading', 'subject'];
const DATE_COLUMNS = ['date', 'reviewdate', 'publishedat', 'time', 'createdat'];
const LIKES_COLUMNS = ['helpful', 'likes', 'upvotes', 'helpfulcount', 'upvote', 'thumbsup'];
const AUTHOR_COLUMNS = ['author', 'reviewer', 'name', 'customername', 'user', 'username'];

/**
 * Auto-detects column indices from the header row
 */
export function detectColumns(headerRow: string[]): {
  textIndex: number;
  ratingIndex: number;
  titleIndex: number;
  dateIndex: number;
  likesIndex: number;
  authorIndex: number;
} {
  const norm = headerRow.map(normalizeHeader);

  // 1. Exact match first
  let titleIndex = norm.findIndex((h) => TITLE_COLUMNS.includes(h));
  let textIndex = norm.findIndex((h, idx) => idx !== titleIndex && TEXT_COLUMNS.includes(h));
  let ratingIndex = norm.findIndex((h) => RATING_COLUMNS.includes(h));
  let dateIndex = norm.findIndex((h) => DATE_COLUMNS.includes(h));
  let likesIndex = norm.findIndex((h) => LIKES_COLUMNS.includes(h));
  let authorIndex = norm.findIndex((h) => AUTHOR_COLUMNS.includes(h));

  // 2. Substring matching fallback
  if (titleIndex === -1) titleIndex = norm.findIndex((h) => TITLE_COLUMNS.some((col) => h.includes(col)));
  if (textIndex === -1) textIndex = norm.findIndex((h, idx) => idx !== titleIndex && TEXT_COLUMNS.some((col) => h.includes(col)));
  if (ratingIndex === -1) ratingIndex = norm.findIndex((h) => RATING_COLUMNS.some((col) => h.includes(col)));
  if (dateIndex === -1) dateIndex = norm.findIndex((h) => DATE_COLUMNS.some((col) => h.includes(col)));
  if (likesIndex === -1) likesIndex = norm.findIndex((h) => LIKES_COLUMNS.some((col) => h.includes(col)));
  if (authorIndex === -1) authorIndex = norm.findIndex((h) => AUTHOR_COLUMNS.some((col) => h.includes(col)));

  return { textIndex, ratingIndex, titleIndex, dateIndex, likesIndex, authorIndex };
}

/**
 * Parses numeric rating from varied string representations ("5", "5.0", "4 out of 5", "★★★★☆")
 */
export function parseRating(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const str = raw.trim();
  if (!str) return undefined;

  // Star symbols count
  if (/[★⭐]/.test(str)) {
    const stars = (str.match(/[★⭐]/g) || []).length;
    if (stars >= 1 && stars <= 5) return stars;
  }

  // Numeric pattern
  const match = str.match(/(\d+(\.\d+)?)/);
  if (match) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val >= 1 && val <= 5) {
      return Math.round(val);
    }
  }
  return undefined;
}

/**
 * Fetches OpenGraph metadata (title, image) from a Flipkart product URL if reachable.
 * Times out quickly (3s) so it never hangs the pipeline.
 */
async function fetchFlipkartOpenGraphMeta(url: string): Promise<{ title?: string; thumbnailUrl?: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1];
    const pageTitle = html
      .match(/<title>([^<]+)<\/title>/i)?.[1]
      ?.replace(/\s*\|.*$/i, '')
      ?.replace(/:\s*Buy.*$/i, '')
      ?.trim();
    const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1];
    return {
      title: ogTitle || pageTitle,
      thumbnailUrl: ogImage,
    };
  } catch {
    return null;
  }
}

export class FlipkartCsvAdapter implements SourceAdapter<SourceInput> {
  readonly id = 'flipkart' as const;

  validateInput(input: SourceInput): SourceInput {
    if (!input.csvContent && !input.pastedText && (!input.rawReviews || input.rawReviews.length === 0) && !input.url) {
      throw new AppError(
        'INVALID_INPUT',
        'Please enter a Flipkart product link',
        400
      );
    }

    if (input.url) {
      const parsed = parseFlipkartUrl(input.url);
      if (!parsed.isValid) {
        throw new AppError('INVALID_URL', 'Please enter a valid Flipkart product URL', 400);
      }
    }

    if (input.csvContent) {
      if (input.csvContent.length > MAX_CSV_SIZE_BYTES) {
        throw new AppError('FILE_TOO_LARGE', 'Upload size exceeds maximum allowed limit of 5 MB', 413);
      }
      const lineCount = (input.csvContent.match(/\n/g) || []).length;
      if (lineCount > MAX_ROWS) {
        throw new AppError('FILE_TOO_LARGE', `Uploaded file exceeds maximum limit of ${MAX_ROWS} rows`, 413);
      }
    }

    if (input.pastedText) {
      if (input.pastedText.length > MAX_CSV_SIZE_BYTES) {
        throw new AppError('FILE_TOO_LARGE', 'Pasted content exceeds maximum allowed limit of 5 MB', 413);
      }
      const lineCount = (input.pastedText.match(/\n/g) || []).length;
      if (lineCount > MAX_ROWS) {
        throw new AppError('FILE_TOO_LARGE', `Pasted content exceeds maximum limit of ${MAX_ROWS} rows`, 413);
      }
    }

    return input;
  }

  async fetchMeta(input: SourceInput): Promise<ProductMeta> {
    const parsedUrl = input.url ? parseFlipkartUrl(input.url) : { isValid: false, productId: '' };
    const productId = input.productMeta?.productId || parsedUrl.productId || `fk-prod-${Date.now().toString(36)}`;

    let scrapedMeta: { title?: string; thumbnailUrl?: string } | null = null;
    if (input.url) {
      scrapedMeta = await fetchFlipkartOpenGraphMeta(input.url);
    }

    const title =
      scrapedMeta?.title ||
      input.productMeta?.title ||
      parsedUrl.slugTitle ||
      'Flipkart Product Analysis';

    const thumbnailUrl =
      scrapedMeta?.thumbnailUrl ||
      input.productMeta?.thumbnailUrl;

    return {
      productId,
      title,
      price: input.productMeta?.price,
      rating: input.productMeta?.rating,
      ratingCount: input.productMeta?.ratingCount,
      reviewCount: input.productMeta?.reviewCount,
      thumbnailUrl,
      productUrl: input.url,
      brand: input.productMeta?.brand,
      source: input.rawReviews ? 'paste' : input.csvContent ? 'csv' : 'demo',
    };
  }

  async fetchItems(
    input: SourceInput,
    opts: FetchOptions,
    onProgress?: (fetchedCount: number) => void
  ): Promise<RawItem[]> {
    const maxItems = opts.maxItems > 0 ? Math.min(opts.maxItems, MAX_ROWS) : MAX_ROWS;

    // 1. If direct raw reviews array was supplied
    if (input.rawReviews && Array.isArray(input.rawReviews) && input.rawReviews.length > 0) {
      logger.info({ count: input.rawReviews.length }, 'Using provided rawReviews array');
      const items = this.processRawReviews(input.rawReviews.slice(0, maxItems));
      onProgress?.(items.length);
      return items;
    }

    // 2. If CSV/JSON text content is present
    const rawContent = input.csvContent || input.pastedText;
    if (rawContent && rawContent.trim()) {
      const items = this.parseContent(rawContent.trim(), maxItems);
      onProgress?.(items.length);
      return items;
    }

    // 3. Demo fallback if no content provided
    logger.info('No reviews supplied for Flipkart analysis — using Flipkart demo fixture');
    const demoItems = this.getDemoReviews(maxItems);
    onProgress?.(demoItems.length);
    return demoItems;
  }

  private parseContent(content: string, maxLimit: number): RawItem[] {
    const clean = stripBOM(content).trim();

    // Try parsing as JSON first
    if ((clean.startsWith('[') && clean.endsWith(']')) || (clean.startsWith('{') && clean.endsWith('}'))) {
      try {
        const parsed = JSON.parse(clean);
        const array = Array.isArray(parsed) ? parsed : parsed.reviews || parsed.data || [];
        if (Array.isArray(array) && array.length > 0) {
          return this.processRawReviews(array.slice(0, maxLimit));
        }
      } catch {
        // Fall through to CSV parser
      }
    }

    // Parse as CSV or line-by-line
    const rows = parseCSV(clean);
    if (rows.length === 0) {
      return [];
    }

    // If only 1 row or multiple rows, check if row 0 is header
    const { textIndex, ratingIndex, titleIndex, dateIndex, likesIndex, authorIndex } = detectColumns(rows[0]);

    const hasHeader = textIndex !== -1;
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const effectiveTextIdx = textIndex !== -1 ? textIndex : 0; // Default to first column

    const results: RawItem[] = [];
    for (let i = 0; i < dataRows.length && results.length < maxLimit; i++) {
      const row = dataRows[i];
      const text = row[effectiveTextIdx]?.trim();
      if (!text) continue;

      const rating = ratingIndex !== -1 ? parseRating(row[ratingIndex]) : undefined;
      const reviewTitle = titleIndex !== -1 ? row[titleIndex]?.trim() : undefined;
      const publishedAt = dateIndex !== -1 && row[dateIndex] ? row[dateIndex].trim() : new Date().toISOString();
      const likesRaw = likesIndex !== -1 ? parseInt(row[likesIndex], 10) : 0;
      const likeCount = !isNaN(likesRaw) && likesRaw >= 0 ? likesRaw : 0;
      const authorName = authorIndex !== -1 && row[authorIndex] ? row[authorIndex].trim() : 'Flipkart Customer';

      const hash = createHash('sha256').update(`${text}:${rating || ''}`).digest('hex').slice(0, 12);

      results.push({
        externalId: `fk-${i}-${hash}`,
        text,
        rating,
        reviewTitle,
        publishedAt,
        likeCount,
        isReply: false,
        authorName,
      });
    }

    return results;
  }

  private processRawReviews(
    reviews: Array<{
      text: string;
      rating?: number;
      title?: string;
      date?: string;
      likes?: number;
      author?: string;
    }>
  ): RawItem[] {
    return reviews
      .filter((r) => r && typeof r.text === 'string' && r.text.trim().length > 0)
      .map((r, i) => {
        const hash = createHash('sha256').update(`${r.text}:${r.rating || ''}`).digest('hex').slice(0, 12);
        return {
          externalId: `fk-${i}-${hash}`,
          text: r.text.trim(),
          rating: typeof r.rating === 'number' && r.rating >= 1 && r.rating <= 5 ? Math.round(r.rating) : undefined,
          reviewTitle: r.title?.trim() || undefined,
          publishedAt: r.date || new Date().toISOString(),
          likeCount: typeof r.likes === 'number' && r.likes >= 0 ? r.likes : 0,
          isReply: false,
          authorName: r.author?.trim() || 'Flipkart Customer',
        };
      });
  }

  getDemoReviews(max = 200): RawItem[] {
    const raw = demoReviewsRaw as Array<{
      id: string;
      text: string;
      rating: number;
      title?: string;
      publishedAt?: string;
      likeCount?: number;
      authorName?: string;
    }>;

    const count = max > 0 ? Math.min(max, raw.length) : raw.length;
    return raw.slice(0, count).map((item, idx) => ({
      externalId: item.id || `fk-demo-${idx}`,
      text: item.text,
      rating: item.rating,
      reviewTitle: item.title,
      publishedAt: item.publishedAt || '2024-03-01T10:00:00.000Z',
      likeCount: item.likeCount ?? Math.floor(Math.random() * 20),
      isReply: false,
      authorName: item.authorName || 'Verified Buyer',
    }));
  }
}
