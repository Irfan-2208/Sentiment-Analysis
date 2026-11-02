import { describe, it, expect } from 'vitest';
import {
  FlipkartCsvAdapter,
  stripBOM,
  parseCSV,
} from '../services/sources/flipkartCsvAdapter.js';
import { AppError } from '../utils/errors.js';

describe('FlipkartCsvAdapter', () => {
  const adapter = new FlipkartCsvAdapter();

  describe('stripBOM', () => {
    it('strips UTF-8 BOM if present', () => {
      const withBOM = '\uFEFFreview,rating\nGreat product,5';
      expect(stripBOM(withBOM)).toBe('review,rating\nGreat product,5');
    });

    it('leaves text without BOM intact', () => {
      const text = 'review,rating\nGreat,5';
      expect(stripBOM(text)).toBe(text);
    });
  });

  describe('parseCSV', () => {
    it('handles commas, newlines, and CRLF correctly', () => {
      const csv = 'text,rating\r\n"Awesome, highly recommended",5\r\n"Normal product",3';
      const rows = parseCSV(csv);
      expect(rows).toHaveLength(3);
      expect(rows[1][0]).toBe('Awesome, highly recommended');
      expect(rows[1][1]).toBe('5');
    });

    it('handles escaped quotes inside quoted strings', () => {
      const csv = 'text,rating\n"It is a ""super"" phone",4';
      const rows = parseCSV(csv);
      expect(rows[1][0]).toBe('It is a "super" phone');
    });

    it('preserves multi-line quoted fields', () => {
      const csv = 'text,rating\n"Line 1\nLine 2",5';
      const rows = parseCSV(csv);
      expect(rows).toHaveLength(2);
      expect(rows[1][0]).toBe('Line 1\nLine 2');
    });
  });

  describe('fetchItems from CSV', () => {
    it('auto-detects common column headers (Review, Star Rating, Title, Likes, Reviewer)', async () => {
      const csv = `Review Title,Customer Review,Star Rating,Helpful Upvotes,Buyer Name\n"Nice camera","The camera is brilliant!",5,14,"Rahul Sharma"`;
      const items = await adapter.fetchItems({ csvContent: csv }, { maxItems: 10 });

      expect(items).toHaveLength(1);
      expect(items[0].text).toBe('The camera is brilliant!');
      expect(items[0].rating).toBe(5);
      expect(items[0].reviewTitle).toBe('Nice camera');
      expect(items[0].likeCount).toBe(14);
      expect(items[0].authorName).toBe('Rahul Sharma');
    });

    it('handles Devanagari / Hindi UTF-8 text', async () => {
      const csv = `comment,rating\n"बहुत ही बढ़िया फ़ोन है, बैटरी भी अच्छी चलती है।",5`;
      const items = await adapter.fetchItems({ csvContent: csv }, { maxItems: 10 });

      expect(items).toHaveLength(1);
      expect(items[0].text).toContain('बहुत ही बढ़िया');
      expect(items[0].rating).toBe(5);
    });

    it('falls back to column 0 if no header matches', async () => {
      const csv = `"Good product"\n"Bad product"`;
      const items = await adapter.fetchItems({ csvContent: csv }, { maxItems: 10 });

      expect(items).toHaveLength(2);
      expect(items[0].text).toBe('Good product');
      expect(items[1].text).toBe('Bad product');
    });

    it('throws FILE_TOO_LARGE when exceeding 5 MB', async () => {
      const largeContent = 'a'.repeat(5 * 1024 * 1024 + 10);
      expect(() => adapter.validateInput({ csvContent: largeContent })).toThrowError(AppError);
    });

    it('throws FILE_TOO_LARGE when exceeding 5,000 rows', async () => {
      const rows = Array.from({ length: 5005 }, (_, i) => `review ${i}`).join('\n');
      expect(() => adapter.validateInput({ csvContent: rows })).toThrowError(AppError);
    });
  });

  describe('fetchItems from pasted text', () => {
    it('splits pasted text by lines', async () => {
      const pasted = `Great phone for daily use\nWorst battery backup ever\nDecent quality`;
      const items = await adapter.fetchItems({ pastedText: pasted }, { maxItems: 10 });

      expect(items).toHaveLength(3);
      expect(items[0].text).toBe('Great phone for daily use');
      expect(items[1].text).toBe('Worst battery backup ever');
    });
  });

  describe('fetchItems from raw JSON reviews', () => {
    it('maps raw review objects', async () => {
      const rawReviews = [
        { text: 'Fast delivery and good packaging', rating: 5, likes: 2, title: 'Superb' },
        { text: 'Received duplicate product', rating: 1, likes: 10, title: 'Fake' },
      ];
      const items = await adapter.fetchItems({ rawReviews }, { maxItems: 10 });

      expect(items).toHaveLength(2);
      expect(items[0].rating).toBe(5);
      expect(items[1].rating).toBe(1);
      expect(items[1].reviewTitle).toBe('Fake');
    });
  });

  describe('Demo fixture', () => {
    it('provides ~200 reviews in offline demo mode', async () => {
      const demoItems = adapter.getDemoReviews();
      expect(demoItems.length).toBeGreaterThanOrEqual(180);

      // Check mix of languages
      const hindiReview = demoItems.find((r) => /[\u0900-\u097F]/.test(r.text));
      expect(hindiReview).toBeDefined();

      const englishReview = demoItems.find((r) => /^[a-zA-Z0-9\s.,!'-]+$/.test(r.text));
      expect(englishReview).toBeDefined();

      // Check star ratings
      const hasRatings = demoItems.every((r) => r.rating && r.rating >= 1 && r.rating <= 5);
      expect(hasRatings).toBe(true);
    });
  });
});

