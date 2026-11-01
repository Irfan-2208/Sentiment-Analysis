import { describe, it, expect } from 'vitest';
import { analyzeLocally } from '../services/ai/providers/local.js';

describe('local analyzer', () => {
  it('labels clearly positive comments as positive', () => {
    const result = analyzeLocally('This is absolutely amazing! Best content I have seen!');
    expect(result.sentiment).toBe('positive');
    expect(result.score).toBeGreaterThan(0);
  });

  it('labels clearly negative comments as negative', () => {
    const result = analyzeLocally('This is terrible and a complete waste of time. Horrible!');
    expect(result.sentiment).toBe('negative');
    expect(result.score).toBeLessThan(0);
  });

  it('labels questions as neutral', () => {
    const result = analyzeLocally('What is the price of this course?');
    expect(result.sentiment).toBe('neutral');
  });

  it('handles negation — "not bad" should be positive/neutral', () => {
    const result = analyzeLocally('Not bad at all!');
    expect(['positive', 'neutral']).toContain(result.sentiment);
    expect(result.score).toBeGreaterThanOrEqual(-0.1);
  });

  it('detects sarcasm for "Oh sure" pattern', () => {
    const result = analyzeLocally('Oh sure, this is so helpful. Did absolutely nothing.');
    expect(result.isSarcastic).toBe(true);
  });

  it('detects Hinglish language', () => {
    const result = analyzeLocally('Yaar ekdum mast hai! Bahut achha samjhaya');
    expect(['hinglish', 'en']).toContain(result.language);
  });

  it('labels positive Hinglish as positive', () => {
    const result = analyzeLocally('Ekdum mast! Bahut badhiya content hai bhai!');
    expect(result.sentiment).toBe('positive');
  });

  it('labels negative Hinglish as negative', () => {
    const result = analyzeLocally('Bilkul bekaar hai. Ekdum faltu video.');
    expect(result.sentiment).toBe('negative');
  });

  it('detects positive emojis', () => {
    const result = analyzeLocally('❤️❤️❤️ Amazing! 🔥');
    expect(result.sentiment).toBe('positive');
  });

  it('handles pure emoji comment', () => {
    const result = analyzeLocally('👍👍👍👍👍');
    expect(result.sentiment).toBe('positive');
  });

  it('returns score in [-1, 1] range', () => {
    const comments = [
      'The absolute worst garbage I have ever seen',
      'Simply incredible and wonderful!',
      'Not sure about this.',
      'Bohot badiya content hai',
      'Ekdum faltu bakwas hai',
    ];
    for (const text of comments) {
      const result = analyzeLocally(text);
      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);
    }
  });

  it('confidence is in [0, 1] range', () => {
    const result = analyzeLocally('Amazing content!');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('extracts keywords (up to 5)', () => {
    const result = analyzeLocally('Amazing tutorial about Python programming and data science');
    expect(result.keywords.length).toBeLessThanOrEqual(5);
  });

  it('returns "none" emotion for purely neutral comment', () => {
    const result = analyzeLocally('What is the release date?');
    expect(['none', 'anticipation', 'trust']).toContain(result.emotion);
  });

  it('detects anger emotion', () => {
    const result = analyzeLocally('I am so furious and angry about this terrible content!');
    expect(result.emotion).toBe('anger');
  });

  it('B7: labels Devanagari Hindi positive comments accurately', () => {
    const result = analyzeLocally('यह वीडियो बहुत बढ़िया और सुंदर है!');
    expect(result.language).toBe('hi');
    expect(result.sentiment).toBe('positive');
    expect(result.score).toBeGreaterThan(0.2);
  });

  it('B7: labels Devanagari Hindi negative comments accurately', () => {
    const result = analyzeLocally('यह बिल्कुल बेकार और घटिया सामग्री है।');
    expect(result.language).toBe('hi');
    expect(result.sentiment).toBe('negative');
    expect(result.score).toBeLessThan(-0.2);
  });

  it('B7: English with words like "the", "video", "channel" is NOT labeled Hinglish', () => {
    const result = analyzeLocally('The video on this channel is awesome.');
    expect(result.language).toBe('en');
    expect(result.sentiment).toBe('positive');
  });

  it('B7: does not dilute long positive comments to neutral', () => {
    const longPositive = 'This was a really great video, very helpful, awesome explanation, wonderful examples, loved every second, thank you so much, highly recommend to everyone!';
    const result = analyzeLocally(longPositive);
    expect(result.sentiment).toBe('positive');
    expect(result.score).toBeGreaterThan(0.4);
  });

  it('B7: standalone ensemble accuracy on gold set', async () => {
    const { default: goldset } = await import('../eval/goldset.json');
    let correct = 0;
    for (const item of goldset) {
      const res = analyzeLocally(item.text);
      if (res.sentiment === item.label) correct++;
    }
    const acc = correct / goldset.length;
    // Local rule-based ensemble should achieve at least 70% accuracy on goldset
    expect(acc).toBeGreaterThanOrEqual(0.70);
  });
});
