import { describe, it, expect } from 'vitest';
import { getSourceAdapter } from '../services/sources/adapterRegistry.js';
import { YouTubeAdapter } from '../services/sources/youtubeAdapter.js';
import { FlipkartCsvAdapter } from '../services/sources/flipkartCsvAdapter.js';
import { FlipkartProviderAdapter } from '../services/sources/flipkartProviderAdapter.js';
import { parseFlipkartUrl } from '../services/sources/flipkartUrlParser.js';

describe('Source Adapters and URL Parsing', () => {
  describe('getSourceAdapter', () => {
    it('returns YouTubeAdapter for youtube platform', () => {
      const adapter = getSourceAdapter('youtube');
      expect(adapter).toBeInstanceOf(YouTubeAdapter);
      expect(adapter.id).toBe('youtube');
    });

    it('returns FlipkartCsvAdapter by default for flipkart platform', () => {
      const adapter = getSourceAdapter('flipkart');
      expect(adapter).toBeInstanceOf(FlipkartCsvAdapter);
      expect(adapter.id).toBe('flipkart');
    });

    it('returns FlipkartProviderAdapter when forceProvider is set', () => {
      const adapter = getSourceAdapter('flipkart', true);
      expect(adapter).toBeInstanceOf(FlipkartProviderAdapter);
      expect(adapter.id).toBe('flipkart');
    });
  });

  describe('parseFlipkartUrl', () => {
    it('extracts product ID from standard Flipkart product URL', () => {
      const url = 'https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4?pid=MOBGTAGPTB3VS24W';
      const parsed = parseFlipkartUrl(url);

      expect(parsed).not.toBeNull();
      expect(parsed?.productId).toBe('itm6ac6485515ae4');
      expect(parsed?.titleSlug).toBe('apple-iphone-15-black-128-gb');
      expect(parsed?.canonicalUrl).toContain('itm6ac6485515ae4');
    });

    it('extracts product ID from dl.flipkart.com short/deep URL', () => {
      const url = 'https://dl.flipkart.com/s/itm123456789abcd';
      const parsed = parseFlipkartUrl(url);

      expect(parsed).not.toBeNull();
      expect(parsed?.productId).toBe('itm123456789abcd');
    });

    it('returns invalid for non-Flipkart URLs', () => {
      expect(parseFlipkartUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ').isValid).toBe(false);
      expect(parseFlipkartUrl('https://www.amazon.in/dp/B08L5VJYV7').isValid).toBe(false);
    });
  });

  describe('FlipkartProviderAdapter guards', () => {
    it('rejects calls when provider is OFF (default)', () => {
      const providerAdapter = new FlipkartProviderAdapter();
      expect(providerAdapter.isEnabled()).toBe(false);

      expect(() =>
        providerAdapter.validateInput({ url: 'https://www.flipkart.com/test/p/itm123' })
      ).toThrow(/FLIPKART_PROVIDER/);
    });
  });
});
