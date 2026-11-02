/**
 * Parser for Flipkart product URLs.
 * Extracts product IDs and titles for display purposes.
 */

export interface ParsedFlipkartUrl {
  isValid: boolean;
  productId: string;
  slugTitle?: string;
  titleSlug?: string;
  canonicalUrl?: string;
}

const FLIPKART_ITEM_ID_REGEX = /(itm[a-zA-Z0-9]+)/i;
const FLIPKART_PID_QUERY_REGEX = /[?&]pid=([a-zA-Z0-9]+)/i;
const FLIPKART_SLUG_REGEX = /flipkart\.com\/([^/?#]+)\/p\//i;

/**
 * Parses a Flipkart URL to extract the product id and title slug.
 * Safe and non-throwing.
 */
export function parseFlipkartUrl(rawUrl: string): ParsedFlipkartUrl {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, productId: '' };
  }

  const trimmed = rawUrl.trim();
  const isFlipkartDomain = /flipkart\.(com|co\.in)/i.test(trimmed);
  if (!isFlipkartDomain) {
    return { isValid: false, productId: '' };
  }

  // 1. Check for itm... pattern or pid query
  const itemMatch = trimmed.match(FLIPKART_ITEM_ID_REGEX);
  const pidMatch = trimmed.match(FLIPKART_PID_QUERY_REGEX);
  const slugMatch = trimmed.match(FLIPKART_SLUG_REGEX);

  const productId = itemMatch?.[1] || pidMatch?.[1] || '';

  if (!productId) {
    return {
      isValid: true,
      productId: 'flipkart-product',
    };
  }

  const titleSlug = slugMatch?.[1];
  const slugTitle = titleSlug
    ? titleSlug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : undefined;

  return {
    isValid: true,
    productId,
    slugTitle,
    titleSlug,
    canonicalUrl: trimmed.split('?')[0],
  };
}
