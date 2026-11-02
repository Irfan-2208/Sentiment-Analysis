import { z } from 'zod';
import { createHash } from 'crypto';
import type { SourceAdapter, SourceInput, FetchOptions, RawItem } from './types.js';
import type { ProductMeta } from '@social-pulse/shared';
import { parseFlipkartUrl } from './flipkartUrlParser.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const ProviderItemSchema = z.object({
  text: z.string().min(1),
  rating: z.union([z.number(), z.string()]).optional(),
  title: z.string().optional(),
  date: z.string().optional(),
  likes: z.union([z.number(), z.string()]).optional(),
  author: z.string().optional(),
});

const ProviderResponseSchema = z.array(ProviderItemSchema);

export class FlipkartProviderAdapter implements SourceAdapter<SourceInput> {
  readonly id = 'flipkart' as const;

  isEnabled(): boolean {
    const provider = (process.env.FLIPKART_PROVIDER || 'none').toLowerCase();
    return provider !== 'none' && Boolean(process.env.FLIPKART_PROVIDER_KEY);
  }

  validateInput(input: SourceInput): SourceInput {
    const provider = process.env.FLIPKART_PROVIDER || 'none';
    if (provider === 'none') {
      throw new AppError(
        'PROVIDER_NOT_CONFIGURED',
        'Third-party Flipkart provider is disabled (FLIPKART_PROVIDER=none). Please upload a CSV/JSON file or paste reviews.',
        400
      );
    }

    if (!input.url) {
      throw new AppError('INVALID_INPUT', 'Flipkart product URL is required when using a third-party provider', 400);
    }

    const parsed = parseFlipkartUrl(input.url);
    if (!parsed.isValid) {
      throw new AppError('INVALID_URL', 'Invalid Flipkart product URL provided', 400);
    }

    return input;
  }

  async fetchMeta(input: SourceInput): Promise<ProductMeta> {
    const parsed = parseFlipkartUrl(input.url || '');
    return {
      productId: parsed.productId || 'flipkart-item',
      title: input.productMeta?.title || parsed.slugTitle || 'Flipkart Product',
      price: input.productMeta?.price,
      rating: input.productMeta?.rating,
      thumbnailUrl: input.productMeta?.thumbnailUrl,
      productUrl: input.url,
      brand: input.productMeta?.brand,
      source: 'provider',
    };
  }

  async fetchItems(
    input: SourceInput,
    opts: FetchOptions,
    onProgress?: (fetchedCount: number) => void
  ): Promise<RawItem[]> {
    const provider = (process.env.FLIPKART_PROVIDER || 'none').toLowerCase();
    const apiKey = process.env.FLIPKART_PROVIDER_KEY;

    if (provider === 'none' || !apiKey) {
      throw new AppError(
        'PROVIDER_NOT_CONFIGURED',
        'FLIPKART_PROVIDER is not configured with an API key. Please use CSV upload or paste mode.',
        400
      );
    }

    logger.info({ provider, url: input.url?.slice(0, 60) }, 'Fetching Flipkart reviews via third-party provider');

    let rawData: unknown[] = [];

    try {
      if (provider === 'apify') {
        const actorId = process.env.FLIPKART_APIFY_ACTOR || 'apify/flipkart-scraper';
        const response = await fetch(
          `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productUrls: [input.url],
              maxReviews: opts.maxItems || 300,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Apify provider responded with HTTP ${response.status}`);
        }
        rawData = (await response.json()) as unknown[];
      } else if (provider === 'custom') {
        const customUrl = process.env.FLIPKART_PROVIDER_URL;
        if (!customUrl) {
          throw new Error('FLIPKART_PROVIDER_URL is missing for custom provider mode');
        }

        const response = await fetch(customUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            url: input.url,
            maxItems: opts.maxItems,
          }),
        });

        if (!response.ok) {
          throw new Error(`Custom provider responded with HTTP ${response.status}`);
        }
        rawData = (await response.json()) as unknown[];
      }
    } catch (err) {
      logger.error({ err: String(err), provider }, 'Third-party review provider error');
      throw new AppError(
        'PROVIDER_REQUEST_FAILED',
        `Third-party provider failed: ${err instanceof Error ? err.message : String(err)}`,
        502
      );
    }

    // Validate provider response
    const parseResult = ProviderResponseSchema.safeParse(rawData);
    if (!parseResult.success) {
      logger.warn({ issues: parseResult.error.issues }, 'Provider response did not match expected review schema');
      throw new AppError('PROVIDER_DATA_INVALID', 'Invalid data format returned by review provider', 502);
    }

    const items: RawItem[] = parseResult.data.map((item, idx) => {
      let ratingNum: number | undefined;
      if (typeof item.rating === 'number') {
        ratingNum = item.rating >= 1 && item.rating <= 5 ? Math.round(item.rating) : undefined;
      } else if (typeof item.rating === 'string') {
        const n = parseFloat(item.rating);
        if (!isNaN(n) && n >= 1 && n <= 5) ratingNum = Math.round(n);
      }

      let likes = 0;
      if (typeof item.likes === 'number') likes = item.likes;
      else if (typeof item.likes === 'string') {
        const n = parseInt(item.likes, 10);
        if (!isNaN(n) && n >= 0) likes = n;
      }

      const hash = createHash('sha256').update(`${item.text}:${ratingNum || ''}`).digest('hex').slice(0, 12);

      return {
        externalId: `fk-prov-${idx}-${hash}`,
        text: item.text.trim(),
        rating: ratingNum,
        reviewTitle: item.title?.trim(),
        publishedAt: item.date || new Date().toISOString(),
        likeCount: likes,
        isReply: false,
        authorName: item.author || 'Flipkart Customer',
      };
    });

    onProgress?.(items.length);
    return items;
  }
}
