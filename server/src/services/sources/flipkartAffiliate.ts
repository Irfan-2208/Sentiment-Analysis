import type { ProductMeta } from '@social-pulse/shared';
import { parseFlipkartUrl } from './flipkartUrlParser.js';
import { logger } from '../../utils/logger.js';

/**
 * Fetches product metadata via the official Flipkart Affiliate API if credentials are provided.
 * Gracefully returns null/fallback if credentials are not configured or request fails.
 */
export async function fetchAffiliateProductMeta(urlOrId: string): Promise<Partial<ProductMeta> | null> {
  const affiliateId = process.env.FLIPKART_AFFILIATE_ID;
  const affiliateToken = process.env.FLIPKART_AFFILIATE_TOKEN;

  if (!affiliateId || !affiliateToken) {
    return null;
  }

  const parsed = parseFlipkartUrl(urlOrId);
  const productId = parsed.productId;
  if (!productId) return null;

  try {
    const apiUrl = `https://affiliate-api.flipkart.net/affiliate/1.0/product.json?id=${encodeURIComponent(productId)}`;
    const response = await fetch(apiUrl, {
      headers: {
        'Fk-Affiliate-Id': affiliateId,
        'Fk-Affiliate-Token': affiliateToken,
      },
    });

    if (!response.ok) {
      logger.warn({ status: response.status, productId }, 'Flipkart Affiliate API returned non-200');
      return null;
    }

    const data = (await response.json()) as {
      productBaseInfoV1?: {
        title?: string;
        maximumRetailPrice?: { amount?: number };
        flipkartSellingPrice?: { amount?: number };
        imageUrls?: Record<string, string>;
        productBrand?: string;
      };
    };

    const base = data.productBaseInfoV1;
    if (!base) return null;

    const images = base.imageUrls || {};
    const thumbnailUrl = images['800x800'] || images['400x400'] || Object.values(images)[0];

    return {
      productId,
      title: base.title || parsed.slugTitle || 'Flipkart Product',
      price: base.flipkartSellingPrice?.amount || base.maximumRetailPrice?.amount,
      brand: base.productBrand,
      thumbnailUrl,
      source: 'affiliate',
    };
  } catch (err) {
    logger.warn({ err: String(err), productId }, 'Error fetching Flipkart Affiliate metadata');
    return null;
  }
}

