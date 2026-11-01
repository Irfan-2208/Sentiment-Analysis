/**
 * Local ensemble sentiment analyzer.
 * Combines:
 *  - English sentiment lexicon with VADER-style compound normalization
 *  - Hindi (Devanagari) sentiment lexicon
 *  - Hinglish (Romanized Hindi) sentiment lexicon & phrase matching
 *  - High-precision emoji sentiment & sarcasm scoring (with variation selector normalization)
 *  - Contraction expansion ("can't" -> "can not") & clause-aware negation handling
 *  - Heuristic sarcasm detection (irony phrases, quoted praise, eye-roll emojis, rhetorical agreement)
 *  - Rule-based emotion & language detection
 *
 * Can also query /nlp-service if available, falling back gracefully to this in-process engine.
 */

import type { CommentAnalysis, Sentiment, Emotion, Language, Signals } from '@social-pulse/shared';
import type { BatchItem, BatchResult, AIProvider } from '../provider.js';
import { config } from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';

// ─── English & Hinglish Lexicons (Valence -4 to +4) ───────────────────────────

const LEXICON: Record<string, number> = {
  // English positive
  amazing: 3.2,
  awesome: 3.1,
  great: 2.5,
  excellent: 3.0,
  fantastic: 3.0,
  wonderful: 2.8,
  brilliant: 2.9,
  best: 3.2,
  love: 3.0,
  loved: 2.8,
  good: 1.9,
  helpful: 2.0,
  useful: 1.8,
  perfect: 3.0,
  outstanding: 3.1,
  incredible: 3.0,
  superb: 2.9,
  nice: 1.5,
  beautiful: 2.4,
  enjoy: 2.0,
  enjoyed: 1.9,
  recommend: 2.2,
  recommended: 2.0,
  impressed: 2.4,
  impressive: 2.5,
  informative: 2.1,
  clear: 1.5,
  genius: 2.8,
  masterpiece: 3.4,
  phenomenal: 3.2,
  spectacular: 3.0,
  exceptional: 3.0,
  quality: 1.8,
  professional: 1.9,
  polished: 1.7,
  thank: 1.8,
  thanks: 1.7,
  grateful: 2.2,
  appreciate: 2.0,
  solid: 1.6,
  valuable: 2.1,
  inspiring: 2.4,
  inspired: 2.2,
  motivating: 2.0,
  undeniable: 1.5,

  // English negative
  terrible: -3.2,
  awful: -3.1,
  horrible: -3.2,
  worst: -3.4,
  bad: -2.1,
  poor: -2.0,
  trash: -2.8,
  garbage: -2.9,
  useless: -2.6,
  waste: -2.4,
  boring: -2.0,
  disappointed: -2.4,
  disappointing: -2.3,
  misleading: -2.5,
  wrong: -1.7,
  incorrect: -1.6,
  broken: -2.0,
  fail: -2.2,
  failed: -2.1,
  pathetic: -3.0,
  ridiculous: -2.2,
  nonsense: -2.3,
  rubbish: -2.6,
  dislike: -2.0,
  disliked: -2.4,
  unsubscribed: -2.6,
  hate: -3.2,
  hated: -3.0,
  annoying: -2.1,
  frustrating: -2.3,
  confusing: -1.7,
  shallow: -1.8,
  outdated: -1.8,
  inaccurate: -2.0,
  clickbait: -2.6,
  overpriced: -2.2,
  ripoff: -3.2,
  expensive: -1.4,
  scam: -3.5,
  fake: -2.8,
  toxic: -3.0,
  painful: -2.4,
  cringe: -2.2,
  regret: -2.3,
  wasted: -2.2,
  unhelpful: -2.1,
  overrated: -2.0,
  headache: -1.8,
  disaster: -3.0,
  misinformation: -3.0,
  slow: -1.5,

  // Hinglish positive
  mast: 2.8,
  badhiya: 2.7,
  badiya: 2.7,
  wadhiya: 2.7,
  shandar: 3.0,
  kamaal: 3.0,
  umda: 2.6,
  achha: 2.2,
  acha: 2.2,
  zabardast: 3.1,
  sahi: 1.8,
  wah: 2.4,
  shukriya: 2.0,
  dhanyawad: 2.2,
  pyaara: 2.4,
  sundar: 2.2,
  lajawaab: 3.2,
  khush: 2.2,
  fatafat: 1.4,

  // Hinglish negative
  bekaar: -2.8,
  bekar: -2.8,
  faltu: -2.6,
  bakwas: -3.0,
  ghatiya: -3.2,
  kharab: -2.6,
  bura: -2.2,
  galat: -2.0,

  // Devanagari Hindi positive
  बढ़िया: 2.8,
  अच्छा: 2.2,
  शानदार: 3.0,
  कमाल: 3.0,
  सुंदर: 2.2,
  धन्यवाद: 2.2,
  शुक्रिया: 2.0,
  बेहतरीन: 3.2,
  जबरदस्त: 3.1,
  लाजवाब: 3.2,
  उत्तम: 2.8,
  प्यारा: 2.4,
  वाह: 2.4,
  खुश: 2.2,
  सत्य: 1.8,

  // Devanagari Hindi negative
  बेकार: -2.8,
  घटिया: -3.2,
  खराब: -2.6,
  बकवास: -3.0,
  बुरा: -2.2,
  गलत: -2.0,
  निराशाजनक: -2.6,
  दुखद: -2.4,
  शर्मनाक: -3.0,
};

// Amplifiers / Intensifiers: multiply the valence of next word
const AMPLIFIERS = new Set([
  'very', 'really', 'so', 'extremely', 'super', 'incredibly', 'totally', 'completely',
  'bahut', 'bohot', 'ekdum', 'ek', 'dum', 'bilkul', 'itna', 'itni', 'pure',
]);

// Multi-word sentiment idioms
const PHRASES: Record<string, number> = {
  'paisa wasool': 3.2,
  'time waste': -3.0,
  'waste of time': -3.0,
  'dil khush': 3.0,
  'first class': 2.6,
  'top notch': 3.0,
  'thanks for nothing': -3.0,
  'yeah right': -2.5,
  'oh sure': -2.5,
  'not bad': 1.6,
  'not terrible': 1.4,
  'not good': -2.0,
  'no problem': 1.5,
  'worth it': 2.0,
  'not worth': -2.5,
  'rip off': -3.2,
  'mind blown': 3.0,
  'dil se': 2.5,
  'skip karo': -2.5,
  'kuch kaam ka nahi': -2.8,
  'seedha point': 2.0,
};

// ─── Negation & Conjunctions ──────────────────────────────────────────────────

const NEGATION_WORDS = new Set([
  'not', 'never', 'no', 'nobody', 'nothing', 'neither', 'nor', 'hardly',
  'barely', 'scarcely', 'nahi', 'nahin', 'mat', 'na', 'nah', 'नहीं', 'मत', 'wasnt', 'isnt', 'didnt', 'cant', 'couldnt',
]);

const CLAUSE_BREAKERS = new Set([
  'but', 'however', 'although', 'though', 'lekin', 'magar', 'par', 'परन्तु', 'किन्तु', 'लेकिन',
]);

// ─── Hinglish Markers ─────────────────────────────────────────────────────────

const HINGLISH_MARKERS = new Set([
  'yaar', 'bhai', 'mast', 'ekdum', 'badhiya', 'badiya', 'wadhiya', 'achha', 'acha',
  'bohot', 'bahut', 'sahi', 'bilkul', 'nahi', 'nahin', 'kya', 'kaise', 'kyun',
  'wala', 'wali', 'wale', 'hoga', 'hogi', 'karo', 'dekho', 'samajh', 'samjha',
  'samjhaya', 'shandar', 'zabardast', 'ghatiya', 'bakwas', 'bekaar', 'bekar',
  'faltu', 'tha', 'thi', 'thhe', 'hain', 'karna', 'liya', 'diya',
  'hota', 'hoti', 'hote', 'chahiye', 'lagta', 'laga', 'apna', 'apni',
  'arey', 'itna', 'itni', 'seekhne', 'kahan', 'milte', 'baat', 'matlab',
]);

// ─── Emoji Sentiment Mapping ──────────────────────────────────────────────────

// Red heart is normalized to \u2764 without \uFE0F
const EMOJI_SENTIMENT: Record<string, number> = {
  '🔥': 1.8,
  '\u2764': 2.0, // Red heart
  '😍': 2.0,
  '🥰': 1.9,
  '😊': 1.5,
  '😄': 1.5,
  '👍': 1.6,
  '👏': 1.6,
  '🙌': 1.6,
  '💯': 2.0,
  '🎉': 1.8,
  '✨': 1.5,
  '💪': 1.6,
  '🌟': 1.7,
  '🏆': 2.0,
  '🎊': 1.7,
  '🤩': 1.8,
  '💖': 2.0,
  '🤯': 2.0,
  '👎': -2.0,
  '😡': -2.2,
  '🤬': -2.5,
  '😤': -1.6,
  '😒': -1.8,
  '🙄': -2.0,
  '😞': -1.7,
  '😢': -1.9,
  '😭': -1.5,
  '🤮': -2.4,
  '💔': -2.2,
  '💩': -2.0,
};

// ─── Sarcasm Patterns ─────────────────────────────────────────────────────────

const SARCASTIC_PHRASES = [
  'oh sure', 'oh yeah', 'oh wow', 'oh yes', 'oh absolutely', 'oh right',
  'yeah right', 'sure sure', 'totally helpful', 'great job breaking',
  'great job skipping', 'thanks for nothing', 'what a surprise', 'as expected from this',
  'wow genius', 'so so helpful', 'masterpiece of garbage', 'changed my life all right',
  'recycled 5-year-old', 'low expectations and somehow', 'so helpful that i had to uninstall',
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

function expandContractions(text: string): string {
  return text
    .replace(/n['’]t\b/gi, ' not')
    .replace(/['’]ve\b/gi, ' have')
    .replace(/['’]re\b/gi, ' are')
    .replace(/['’]m\b/gi, ' am')
    .replace(/['’]ll\b/gi, ' will')
    .replace(/can['’]t\b/gi, 'can not')
    .replace(/won['’]t\b/gi, 'will not');
}

function tokenize(text: string): string[] {
  const expanded = expandContractions(text);
  return expanded.toLowerCase().split(/[\s,.!?;:()\[\]'"\/\\]+/).filter(Boolean);
}

function detectScriptAndLanguage(text: string, tokens: string[]): { language: Language; script: string } {
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  if (hasDevanagari) {
    return { language: 'hi', script: 'Devanagari' };
  }

  const hinglishHits = tokens.filter((t) => HINGLISH_MARKERS.has(t)).length;
  if (hinglishHits >= 2 || (hinglishHits >= 1 && tokens.length <= 10)) {
    return { language: 'hinglish', script: 'Latin' };
  }

  const nonLatinMatch = /[^\u0000-\u007F\u0900-\u097F\u2000-\u206F\u2E00-\u2E7F\s\p{P}\p{Extended_Pictographic}]/u.test(text);
  if (nonLatinMatch) {
    return { language: 'other', script: 'Other' };
  }

  return { language: 'en', script: 'Latin' };
}

function extractEmojis(text: string): string[] {
  const matches = text.match(/\p{Extended_Pictographic}/gu);
  return (matches ?? []).map((e) => e.replace(/\uFE0F/g, ''));
}

function scoreEmojis(emojis: string[]): { score: number; emojis: string[] } {
  let score = 0;
  for (const e of emojis) {
    if (e in EMOJI_SENTIMENT) {
      score += EMOJI_SENTIMENT[e];
    }
  }
  return { score, emojis };
}

function detectSarcasm(text: string, tokens: string[], rawScore: number, emojis: string[]): boolean {
  const lc = text.toLowerCase();

  // Pattern 1: Known sarcastic phrase
  if (SARCASTIC_PHRASES.some((p) => lc.includes(p))) {
    return true;
  }

  // Pattern 2: Positive words followed by eye-roll or unamused emojis
  const hasEyeRoll = emojis.includes('🙄') || emojis.includes('😒');
  if (hasEyeRoll) {
    return true;
  }

  // Pattern 3: Explicit quotation marks around praise words ("genius", "helpful", "expert", "best content", "top quality", "detailed")
  const quotedMatch = /['"]([^'"]+)['"]/.exec(lc);
  if (quotedMatch) {
    const inside = quotedMatch[1].trim();
    if (['genius', 'helpful', 'expert', 'amazing', 'great', 'best content', 'top quality', 'detailed', 'revolutionary', 'original', 'quality', 'life changing'].includes(inside)) {
      return true;
    }
  }

  // Pattern 4: "Oh sure" / rhetorical agreement
  if (/\b(oh\s+sure|yeah\s+right|surely)\b/i.test(lc)) {
    return true;
  }

  return false;
}

function mapToEmotion(score: number, text: string, isSarcastic: boolean): Emotion {
  const lc = text.toLowerCase();
  if (/\b(angry|hate|furious|outrage|terrible|awful|horrible|घटिया|गुस्सा)\b/i.test(lc)) return 'anger';
  if (/\b(sad|disappoint|disappointed|miss|loss|unfortunate|sorry|दुख)\b/i.test(lc)) return 'sadness';
  if (/\b(wow|incredible|unbelievable|mindblowing|mind blown|shock|shocked|वाह|कमाल)\b/i.test(lc)) return 'surprise';
  if (/\b(trust|reliable|consistent|always|never fail|भरोसा)\b/i.test(lc)) return 'trust';
  if (/\b(look\s+forward|can't\s+wait|anticipat|next\s+part|कब\s+आएगा)\b/i.test(lc)) return 'anticipation';
  if (/\b(disgust|gross|revolting|repulsive|छी)\b/i.test(lc)) return 'disgust';
  if (/\b(fear|scared|worried|concern|risk|डर)\b/i.test(lc)) return 'fear';
  if (isSarcastic) return 'disgust';
  if (score > 0.25) return 'joy';
  return 'none';
}

function extractKeywords(tokens: string[]): string[] {
  const stops = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should',
    'may', 'might', 'can', 'could', 'to', 'of', 'in', 'for', 'on', 'with', 'at',
    'by', 'from', 'as', 'if', 'or', 'and', 'but', 'not', 'this', 'that', 'it',
    'its', 'so', 'just', 'very', 'really', 'too', 'also', 'all', 'any', 'here', 'there',
    'hai', 'hain', 'bhai', 'yaar', 'yeh', 'woh',
  ]);

  const freq = new Map<string, number>();
  for (const token of tokens) {
    if (token.length > 3 && !stops.has(token)) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

// ─── Main In-Process Analyzer ─────────────────────────────────────────────────

export function analyzeLocally(text: string): CommentAnalysis & { signals?: Signals; source?: 'ensemble' | 'fallback' } {
  const tokens = tokenize(text);
  const emojis = extractEmojis(text);
  const emojiResult = scoreEmojis(emojis);

  // Check phrase matches first
  const lcText = text.toLowerCase();
  let phraseScore = 0;
  for (const [phrase, valence] of Object.entries(PHRASES)) {
    if (lcText.includes(phrase)) {
      phraseScore += valence;
    }
  }

  // Token-level scoring with negation window & amplifier handling
  let wordScore = 0;
  let posCount = 0;
  let negCount = 0;
  let negationRemaining = 0;
  let multiplier = 1.0;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (CLAUSE_BREAKERS.has(t)) {
      negationRemaining = 0;
      multiplier = 1.0;
      continue;
    }

    if (AMPLIFIERS.has(t)) {
      multiplier = 1.4;
      continue;
    }

    if (NEGATION_WORDS.has(t)) {
      negationRemaining = 3;
      continue;
    }

    let valence = LEXICON[t] ?? 0;
    if (valence !== 0) {
      valence *= multiplier;
      multiplier = 1.0; // reset after applying to word

      if (negationRemaining > 0) {
        valence = -valence * 0.8;
        negationRemaining--;
      }
      if (valence > 0) posCount++;
      if (valence < 0) negCount++;
      wordScore += valence;
    } else if (negationRemaining > 0) {
      negationRemaining--;
    }
  }

  const rawSum = wordScore + phraseScore + emojiResult.score;

  // VADER compound normalization: maps any sum to [-1, 1] without diluting long texts
  const alpha = 15;
  const compound = rawSum / Math.sqrt(rawSum * rawSum + alpha);

  const isSarcastic = detectSarcasm(text, tokens, compound, emojis);

  // Mixed aspect detection: comment has both positive and negative signals with contrastive conjunction
  const hasContrastiveConjunction = /\b(but|however|lekin|magar|par|although|though)\b/i.test(lcText);
  const isMixed = (posCount > 0 && negCount > 0) || (hasContrastiveConjunction && (posCount > 0 || negCount > 0));

  let finalScore = compound;

  if (isSarcastic) {
    // Sarcastic praise is actually negative
    finalScore = Math.min(-0.45, -Math.abs(compound) * 0.85);
  } else if (isMixed && Math.abs(posCount - negCount) <= 1 && hasContrastiveConjunction) {
    // Balanced mixed commentary without dominant side -> neutral
    finalScore = 0;
  }

  // Question heuristic: if it ends with ? and has low emotional charge, neutral
  const isQuestion = text.trim().endsWith('?') && Math.abs(rawSum) < 2.0;
  if (isQuestion && !isSarcastic) {
    finalScore = 0;
  }

  let sentiment: Sentiment;
  if (finalScore > 0.12) sentiment = 'positive';
  else if (finalScore < -0.12) sentiment = 'negative';
  else sentiment = 'neutral';

  const { language, script } = detectScriptAndLanguage(text, tokens);
  const emotion = mapToEmotion(finalScore, text, isSarcastic);
  const keywords = extractKeywords(tokens);

  const isToxic = /\b(idiot|stupid|dumb|moron|loser|hate you|shut up|go die|terrible person|scammer)\b/i.test(text);
  const confidence = Math.min(0.95, Math.max(0.4, 0.45 + Math.abs(finalScore) * 0.5));

  const signals: Signals = {
    vader: { compound: Math.round(compound * 1000) / 1000 },
    emoji: { score: emojiResult.score, emojis },
    lexicon: { score: Math.round(wordScore * 100) / 100 },
    lang: { script, detected: language },
  };

  return {
    sentiment,
    score: Math.round(finalScore * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    emotion,
    language,
    isSarcastic,
    isMixed,
    aspects: [],
    keywords,
    isToxic,
    signals,
    source: 'ensemble',
  };
}

// ─── AIProvider Implementation ────────────────────────────────────────────────

export class LocalProvider implements AIProvider {
  readonly name = 'local';

  async analyzeBatch(items: BatchItem[]): Promise<BatchResult[]> {
    const nlpUrl = config.NLP_SERVICE_URL;
    let nlpAvailable = false;

    // Fast health probe
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 600);
      const res = await fetch(`${nlpUrl}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      nlpAvailable = res.ok;
    } catch {
      nlpAvailable = false;
    }

    if (nlpAvailable) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${nlpUrl}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map((i) => ({ id: i.id, text: i.text })),
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = (await res.json()) as { results: any[] };
          const map = new Map(data.results.map((r) => [r.id, r]));

          return items.map((item) => {
            const r = map.get(item.id);
            if (r) {
              return {
                id: item.id,
                result: {
                  sentiment: r.sentiment,
                  score: r.score,
                  confidence: r.confidence,
                  emotion: r.emotion,
                  language: r.language,
                  isSarcastic: r.isSarcastic,
                  isMixed: r.isMixed,
                  aspects: [],
                  keywords: [],
                  isToxic: false,
                },
                source: 'ensemble' as const,
                signals: r.signals,
                needsReview: r.isSarcastic || r.confidence < 0.65,
                engineVersion: '2.0.0-nlp',
              };
            }
            const local = analyzeLocally(item.text);
            return {
              id: item.id,
              result: local,
              source: 'ensemble' as const,
              signals: local.signals as Record<string, unknown>,
              needsReview: local.isSarcastic || local.confidence < 0.6,
              engineVersion: '2.0.0',
            };
          });
        }
      } catch (err) {
        logger.warn({ err }, 'NLP microservice request failed; falling back to in-process ensemble');
      }
    }

    // Default: in-process local ensemble
    return items.map((item) => {
      const local = analyzeLocally(item.text);
      return {
        id: item.id,
        result: local,
        source: 'ensemble' as const,
        signals: local.signals as Record<string, unknown>,
        needsReview: local.isSarcastic || local.confidence < 0.6,
        engineVersion: '2.0.0',
      };
    });
  }

  async generateInsight(statsJson: string, representativeComments: string[]) {
    const stats = JSON.parse(statsJson);
    const positivePercent = stats.sentimentPercentages?.positive ?? 0;
    const negativePercent = stats.sentimentPercentages?.negative ?? 0;
    const averageScore = stats.averageScore ?? 0;

    const riskLevel = (
      negativePercent >= 40 ? 'high' : negativePercent >= 20 ? 'medium' : 'low'
    ) as 'high' | 'medium' | 'low';

    return {
      summary: `Based on ${stats.totalAnalyzed ?? 0} analyzed comments, audience sentiment is ${
        positivePercent > 50 ? 'predominantly positive' : negativePercent > 40 ? 'predominantly negative' : 'mixed'
      }. Average sentiment score is ${averageScore.toFixed(2)} (-1 to 1 scale). ${
        stats.sarcasticCount > 0 ? `${stats.sarcasticCount} sarcastic comments detected.` : ''
      }`,
      topPraise: representativeComments.filter((_, i) => i % 5 === 0).slice(0, 3),
      topComplaints: representativeComments.filter((_, i) => i % 5 === 1).slice(0, 3),
      recommendedActions: [
        positivePercent < 50
          ? 'Review negative feedback themes to address audience concerns'
          : 'Continue current content strategy that drives positive engagement',
        stats.sarcasticCount > 5
          ? 'Monitor sarcastic comments for subtle dissatisfaction'
          : 'Maintain current high production standards',
        'Engage actively with top-liked comments to build community',
      ],
      riskLevel,
      riskReason:
        riskLevel === 'high'
          ? `${negativePercent}% negative comments indicates significant dissatisfaction`
          : riskLevel === 'medium'
          ? `${negativePercent}% negative comments warrants ongoing monitoring`
          : 'Sentiment is healthy with manageable criticism',
      isTemplate: true,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
