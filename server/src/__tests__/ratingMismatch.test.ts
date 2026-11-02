import { describe, it, expect } from 'vitest';
import { LocalProvider, extractReviewAspects } from '../services/ai/providers/local.js';

describe('Review Aspects and Rating vs Text Mismatch', () => {
  const provider = new LocalProvider();

  describe('extractReviewAspects', () => {
    it('extracts e-commerce aspects like battery, delivery, price, quality', () => {
      const text = 'The battery life is amazing and fast delivery, but the price is too high.';
      const aspects = extractReviewAspects(text, 'neutral', 0);

      const aspectNames = aspects.map((a) => a.aspect);
      expect(aspectNames).toContain('battery');
      expect(aspectNames).toContain('delivery');
      expect(aspectNames).toContain('price');
    });

    it('extracts packaging and camera aspects', () => {
      const text = 'Packaging was completely damaged, though camera quality is awesome.';
      const aspects = extractReviewAspects(text, 'neutral', 0);

      const aspectNames = aspects.map((a) => a.aspect);
      expect(aspectNames).toContain('packaging');
      expect(aspectNames).toContain('camera');
    });

    it('extracts fake/genuineness aspect', () => {
      const text = 'Received a fake product, duplicate copy sent by seller!';
      const aspects = extractReviewAspects(text, 'negative', -0.8);

      const aspectNames = aspects.map((a) => a.aspect);
      expect(aspectNames).toContain('genuineness');
      const genAspect = aspects.find((a) => a.aspect === 'genuineness');
      expect(genAspect?.sentiment).toBe('negative');
    });
  });

  describe('Rating vs Text Mismatch and Sarcasm', () => {
    it('detects 1-star review with sarcastic praise and flips sentiment to negative', async () => {
      const [result] = await provider.analyzeBatch(
        [
          {
            id: 'c001',
            text: 'Masterclass packaging by Flipkart! Screen came broken in 100 pieces bravo!',
            platform: 'flipkart',
            rating: 1,
          },
        ],
        'v1'
      );

      expect(result.result.sentiment).toBe('negative');
      expect(result.result.isSarcastic).toBe(true);
      expect(result.needsReview).toBe(true);
    });

    it('flags rating mismatch when 1-star has praise', async () => {
      const [result] = await provider.analyzeBatch(
        [
          {
            id: 'c002',
            text: 'Great product, absolutely loved it!',
            platform: 'flipkart',
            rating: 1,
          },
        ],
        'v1'
      );

      // Even if raw text is positive, with 1 star it must flag mismatch / needsReview
      expect(result.needsReview).toBe(true);
    });

    it('does NOT flag consistent 5-star review with positive text', async () => {
      const [result] = await provider.analyzeBatch(
        [
          {
            id: 'c003',
            text: 'Wonderful phone, superb camera and great value for money!',
            platform: 'flipkart',
            rating: 5,
          },
        ],
        'v1'
      );

      expect(result.result.sentiment).toBe('positive');
      expect(result.needsReview).toBe(false);
    });

    it('flags rating mismatch when 5-star has negative text', async () => {
      const [result] = await provider.analyzeBatch(
        [
          {
            id: 'c004',
            text: 'Terrible build quality, stopped working within 2 days. Complete waste of money.',
            platform: 'flipkart',
            rating: 5,
          },
        ],
        'v1'
      );

      expect(result.result.sentiment).toBe('negative');
      expect(result.needsReview).toBe(true);
    });
  });
});
