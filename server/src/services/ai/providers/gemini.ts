import { GoogleGenAI } from '@google/genai';
import PQueue from 'p-queue';
import { createHash } from 'crypto';
import { z } from 'zod';
import type { CommentAnalysis } from '@social-pulse/shared';
import type { BatchItem, BatchResult, AIProvider } from '../provider.js';
import { analyzeLocally } from './local.js';
import { config } from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import { sleep } from '../../../utils/retry.js';
import { AnalysisCache } from '../../../models/AnalysisCache.js';
import mongoose from 'mongoose';

// Engine version — bump when prompt or schema changes
const ENGINE_VERSION = '2.0.0';
const PROMPT_VER = '1.2';

// ─── Rate Limiter (B4: p-queue with intervalCap from GEMINI_RPM) ───────────────

const geminiRateLimiter = new PQueue({
  intervalCap: config.GEMINI_RPM > 0 ? config.GEMINI_RPM : 5,
  interval: 60_000,
});

// ─── System prompts ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT_YOUTUBE = `You are a multilingual social media comment sentiment analysis engine.

CRITICAL RULES:
1. Analyze EVERY comment ID provided. Return exactly one result per ID — no more, no less.
2. Return ONLY valid JSON matching the exact schema. No markdown backticks or commentary.
3. Understand Hinglish (Romanized Hindi mixed with English). Common words: yaar, bhai, mast, ekdum, achha, bakwas, sahi, bohot, toh, hai, kya.
4. Detect sarcasm from context — a positive-sounding phrase in a negative context is sarcastic. Label by INTENDED meaning.
5. Handle emojis as sentiment signals: 🔥😍❤️👍 → positive; 🙄😒😡👎 → negative.
6. Questions and neutral factual statements → neutral sentiment.
7. Mixed comments: assign an overall label based on dominant tone, set isMixed=true.
8. Never invent content. Only analyze what is given.
9. isToxic: true only for hate speech, slurs, or direct personal attacks.
10. reasoning: concise explanation (<= 20 words) explaining why this label was assigned.

SENTIMENT LABELS:
- positive: clearly favorable, praising, happy
- negative: clearly unfavorable, complaining, critical
- neutral: factual, questions, balanced, mixed without clear dominant

SARCASM DETECTION:
Patterns: "Oh sure [negative context]", "Yeah right", "So helpful [irony]", positive words + eye-roll emojis.
When sarcastic: the label must reflect ACTUAL meaning, not literal words.`;

const SYSTEM_PROMPT_FLIPKART = `You are a multilingual e-commerce product review sentiment analysis engine analyzing customer reviews.

CRITICAL RULES:
1. Analyze EVERY review ID provided. Return exactly one result per ID — no more, no less.
2. Return ONLY valid JSON matching the exact schema. No markdown backticks or commentary.
3. Understand Hinglish (Romanized Hindi mixed with English) and Devanagari Hindi. Common words: yaar, bhai, mast, ekdum, achha, bakwas, sahi, bohot, paisa wasool, bekar, toota hua, duplicate, nakli, fake, dabba.
4. Product Review Aspects: Identify and extract specific aspects mentioned: quality, price, delivery, packaging, battery, camera, service, fit/size, durability, genuineness/authenticity, along with their sentiment.
5. Star Rating vs Text Mismatch: If a customer rating is low (1 or 2 stars) but text uses praise words (e.g., "Arrived in 50 pieces, what a masterclass!"), detect sarcasm or rating mismatch and label the actual intended negative sentiment.
6. Handle emojis as sentiment signals: 🔥😍❤️👍 → positive; 🙄😒😡👎 → negative.
7. Mixed reviews: assign an overall label based on dominant tone, set isMixed=true.
8. Never invent content. Only analyze what is given.
9. isToxic: true only for hate speech, slurs, or direct personal attacks.
10. reasoning: concise explanation (<= 20 words) explaining why this label was assigned.

SENTIMENT LABELS:
- positive: clearly favorable, praising, satisfied
- negative: clearly unfavorable, complaining, defective, fake product, poor quality
- neutral: balanced, factual without clear leaning`;

const SYSTEM_PROMPT = SYSTEM_PROMPT_YOUTUBE;

// ─── Response schema ──────────────────────────────────────────────────────────

const CommentResultSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  emotion: z.enum(['joy', 'anger', 'sadness', 'fear', 'surprise', 'disgust', 'trust', 'anticipation', 'none']),
  language: z.enum(['en', 'hi', 'hinglish', 'other']),
  isSarcastic: z.boolean(),
  isMixed: z.boolean(),
  aspects: z.array(z.object({ aspect: z.string(), sentiment: z.enum(['positive', 'negative', 'neutral']) })).max(10),
  keywords: z.array(z.string()).max(5),
  isToxic: z.boolean(),
  reasoning: z.string().max(200).optional(),
});

const BatchResponseSchema = z.record(z.string(), CommentResultSchema);

// JSON schema for Gemini structured output
const RESPONSE_JSON_SCHEMA = {
  type: 'OBJECT',
  additionalProperties: {
    type: 'OBJECT',
    properties: {
      sentiment: { type: 'STRING', enum: ['positive', 'negative', 'neutral'] },
      score: { type: 'NUMBER' },
      confidence: { type: 'NUMBER' },
      emotion: { type: 'STRING', enum: ['joy', 'anger', 'sadness', 'fear', 'surprise', 'disgust', 'trust', 'anticipation', 'none'] },
      language: { type: 'STRING', enum: ['en', 'hi', 'hinglish', 'other'] },
      isSarcastic: { type: 'BOOLEAN' },
      isMixed: { type: 'BOOLEAN' },
      aspects: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            aspect: { type: 'STRING' },
            sentiment: { type: 'STRING', enum: ['positive', 'negative', 'neutral'] },
          },
          required: ['aspect', 'sentiment'],
        },
      },
      keywords: { type: 'ARRAY', items: { type: 'STRING' } },
      isToxic: { type: 'BOOLEAN' },
      reasoning: { type: 'STRING' },
    },
    required: ['sentiment', 'score', 'confidence', 'emotion', 'language', 'isSarcastic', 'isMixed', 'aspects', 'keywords', 'isToxic'],
  },
};

// ─── Cache key builder (B1 fix: derive key from text content, never batch id) ─

function buildCacheKey(text: string, model: string, promptVersion: string): string {
  const normalizedText = text.trim().toLowerCase();
  return createHash('sha256')
    .update(`${ENGINE_VERSION}|${model}|${promptVersion}|${normalizedText}`)
    .digest('hex');
}

function extractRetryAfterMs(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = err as any;
  const is429 =
    anyErr.status === 429 ||
    anyErr.statusCode === 429 ||
    String(anyErr.message).includes('429') ||
    String(anyErr.message).includes('RESOURCE_EXHAUSTED');
  if (!is429) return null;

  const retryHeader = anyErr.headers?.['retry-after'] || anyErr.response?.headers?.['retry-after'];
  if (retryHeader) {
    const seconds = parseInt(String(retryHeader), 10);
    if (!isNaN(seconds) && seconds > 0) return seconds * 1000;
  }

  const msg = String(anyErr.message);
  const match = msg.match(/retry in ([0-9.]+)s/i);
  if (match) {
    const s = parseFloat(match[1]);
    if (!isNaN(s) && s > 0) return Math.ceil(s * 1000);
  }

  return 12_000;
}

// ─── Gemini Provider ──────────────────────────────────────────────────────────

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private client: GoogleGenAI;
  private model: string;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY ?? '' });
    this.model = config.GEMINI_MODEL;
  }

  async isAvailable(): Promise<boolean> {
    return !!(config.GEMINI_API_KEY);
  }

  async analyzeBatch(items: BatchItem[], promptVersion: string): Promise<BatchResult[]> {
    if (items.length === 0) return [];

    const isDbConnected = mongoose.connection.readyState === 1;
    const results: BatchResult[] = [];
    const uncachedItems: BatchItem[] = [];

    // Step 1: Check cache for every item
    for (const item of items) {
      if (isDbConnected) {
        const cacheKey = buildCacheKey(item.text, this.model, promptVersion);
        try {
          const cached = await AnalysisCache.findOne({ key: cacheKey });
          if (cached) {
            results.push({
              id: item.id,
              result: cached.result as CommentAnalysis,
              source: 'llm',
              engineVersion: ENGINE_VERSION,
            });
            continue;
          }
        } catch {
          // Cache read error — non-fatal
        }
      }
      uncachedItems.push(item);
    }

    if (uncachedItems.length === 0) return results;

    // Step 2: Model fallback chain (B4: GEMINI_MODEL, then GEMINI_FALLBACK_MODELS)
    const modelsToTry = [this.model, ...(config.GEMINI_FALLBACK_MODELS ?? [])];
    const parsedMap: Record<string, CommentAnalysis & { reasoning?: string }> = {};
    let pendingItems = [...uncachedItems];

    const isFlipkart = items.some((i) => i.platform === 'flipkart');
    const systemInstruction = isFlipkart ? SYSTEM_PROMPT_FLIPKART : SYSTEM_PROMPT_YOUTUBE;

    modelLoop: for (const activeModel of modelsToTry) {
      if (pendingItems.length === 0) break;

      // Attempt up to 3 tries per model with rate limiter & Retry-After handling
      for (let attempt = 1; attempt <= 3 && pendingItems.length > 0; attempt++) {
        try {
          const prompt = this.buildPrompt(pendingItems);

          // Rate-limited dispatch (B4)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const response: any = await geminiRateLimiter.add(async () => {
            return this.client.models.generateContent({
              model: activeModel,
              contents: prompt,
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                responseSchema: RESPONSE_JSON_SCHEMA as any,
                temperature: 0,
              },
            });
          });

          const text = response?.text ?? '';
          const raw = JSON.parse(text);
          const validated = BatchResponseSchema.parse(raw);

          // Save received items
          for (const item of pendingItems) {
            if (validated[item.id]) {
              parsedMap[item.id] = validated[item.id];
            }
          }

          // B3 fix: Only retry missing IDs on next iteration
          pendingItems = pendingItems.filter((i) => !parsedMap[i.id]);
          if (pendingItems.length === 0) break; // All received!
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const isConnectivity = errMsg.includes('fetch failed') || errMsg.includes('ENOTFOUND') || errMsg.includes('ECONNREFUSED');
          const retryAfterMs = extractRetryAfterMs(err);
          const isRateLimit = retryAfterMs !== null;
          logger.warn(
            { err: errMsg, model: activeModel, attempt, pending: pendingItems.length, isRateLimit, isConnectivity },
            `Gemini request attempt ${attempt} failed`
          );

          if (isConnectivity) {
            // No network connectivity available in this environment; don't spin retries across models
            break modelLoop;
          }

          if (attempt < 3) {
            const delay = isRateLimit ? retryAfterMs : Math.min(5000, 500 * Math.pow(2, attempt - 1) + Math.random() * 250);
            await sleep(delay);
          }
        }
      }
    }

    // Step 3: Align results and fallback only for missing IDs (B2)
    const batchResults: BatchResult[] = [];
    for (const item of uncachedItems) {
      const parsed = parsedMap[item.id];
      if (parsed) {
        // Cache result in DB
        if (isDbConnected) {
          const cacheKey = buildCacheKey(item.text, this.model, promptVersion);
          try {
            await AnalysisCache.findOneAndUpdate(
              { key: cacheKey },
              { key: cacheKey, result: parsed },
              { upsert: true, new: true }
            );
          } catch {
            // Non-fatal
          }
        }

        const needsReview = parsed.isSarcastic || parsed.confidence < 0.65 || parsed.isMixed;
        batchResults.push({
          id: item.id,
          result: parsed,
          source: 'llm',
          reasoning: parsed.reasoning,
          needsReview,
          engineVersion: ENGINE_VERSION,
        });
      } else {
        // Never silent fallback — log error and mark provenance (B2)
        logger.error(
          { id: item.id, textSample: item.text.slice(0, 50) },
          'Comment failed AI analysis across all retries/models; using local ensemble fallback'
        );
        const local = analyzeLocally(item.text, { platform: item.platform, rating: item.rating });
        batchResults.push({
          id: item.id,
          result: local,
          source: 'fallback',
          signals: local.signals as Record<string, unknown>,
          needsReview: true,
          engineVersion: ENGINE_VERSION,
        });
      }
    }

    return [...results, ...batchResults];
  }

  private buildPrompt(items: BatchItem[]): string {
    const isFlipkart = items.some((i) => i.platform === 'flipkart');
    const itemLabel = isFlipkart ? 'e-commerce product reviews' : 'comments';
    const commentsList = items
      .map((item) => {
        const ratingHint = item.rating ? ` [Customer Rating: ${item.rating}/5 stars]` : '';
        return `"${item.id}": ${JSON.stringify(item.text)}${ratingHint}`;
      })
      .join('\n');

    return `Analyze the sentiment of these ${items.length} ${itemLabel}. Return ONLY a valid JSON object where each key is the ID and each value matches this structure:
{
  "<id>": {
    "sentiment": "positive" | "negative" | "neutral",
    "score": <number between -1.0 and 1.0>,
    "confidence": <number between 0.0 and 1.0>,
    "emotion": "joy" | "anger" | "sadness" | "fear" | "surprise" | "disgust" | "trust" | "anticipation" | "none",
    "language": "en" | "hi" | "hinglish" | "other",
    "isSarcastic": <boolean>,
    "isMixed": <boolean>,
    "aspects": [{"aspect": string, "sentiment": "positive" | "negative" | "neutral"}],
    "keywords": [string],
    "isToxic": <boolean>,
    "reasoning": <concise explanation string <= 20 words>
  }
}

Comments to analyze:
${commentsList}

Return exactly these ${items.length} IDs as object keys: ${items.map((i) => i.id).join(', ')}`;
  }

  async generateInsight(
    statsJson: string,
    representativeComments: string[]
  ): Promise<{
    summary: string;
    topPraise: string[];
    topComplaints: string[];
    recommendedActions: string[];
    riskLevel: 'low' | 'medium' | 'high';
    riskReason: string;
  }> {
    const commentsText = representativeComments
      .slice(0, 30)
      .map((c, i) => `${i + 1}. ${c}`)
      .join('\n');

    const prompt = `You are analyzing YouTube comment sentiment data. Based on these aggregated statistics and representative comments, generate a concise executive insight.

STATISTICS:
${statsJson}

REPRESENTATIVE COMMENTS (sample of up to 30):
${commentsText}

Return ONLY a JSON object with these exact fields:
{
  "summary": "3 sentences max about overall sentiment",
  "topPraise": ["up to 3 specific things audiences praise"],
  "topComplaints": ["up to 3 specific recurring complaints"],
  "recommendedActions": ["3-5 concrete, prioritized action items"],
  "riskLevel": "low|medium|high",
  "riskReason": "one sentence explaining the risk level"
}`;

    try {
      const insightSchema = {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING' },
          topPraise: { type: 'ARRAY', items: { type: 'STRING' } },
          topComplaints: { type: 'ARRAY', items: { type: 'STRING' } },
          recommendedActions: { type: 'ARRAY', items: { type: 'STRING' } },
          riskLevel: { type: 'STRING', enum: ['low', 'medium', 'high'] },
          riskReason: { type: 'STRING' },
        },
        required: ['summary', 'topPraise', 'topComplaints', 'recommendedActions', 'riskLevel', 'riskReason'],
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any = await geminiRateLimiter.add(async () => {
        return this.client.models.generateContent({
          model: this.model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            responseSchema: insightSchema as any,
            temperature: 0.3,
          },
        });
      });

      const text = response?.text ?? '{}';
      return JSON.parse(text);
    } catch (err) {
      logger.warn({ err }, 'Gemini insight generation failed, using template');
      const stats = JSON.parse(statsJson);
      const negPct = stats.sentimentPercentages?.negative ?? 0;
      return {
        summary: `Analysis of ${stats.totalAnalyzed ?? 0} comments shows ${stats.sentimentPercentages?.positive ?? 0}% positive sentiment. Average score: ${(stats.averageScore ?? 0).toFixed(2)}.`,
        topPraise: ['Content quality', 'Clear explanations', 'Helpful information'],
        topComplaints: ['Could use improvement', 'Some areas need work', 'More depth needed'],
        recommendedActions: ['Address top negative feedback themes', 'Amplify what audiences praise', 'Monitor sarcastic comments for hidden frustrations'],
        riskLevel: negPct >= 40 ? 'high' : negPct >= 20 ? 'medium' : 'low',
        riskReason: `${negPct.toFixed(0)}% negative comment ratio`,
      };
    }
  }
}
