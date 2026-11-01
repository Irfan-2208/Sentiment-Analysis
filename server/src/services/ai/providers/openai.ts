import OpenAI from 'openai';
import { z } from 'zod';
import type { CommentAnalysis } from '@social-pulse/shared';
import type { BatchItem, BatchResult, AIProvider } from '../provider.js';
import { analyzeLocally } from './local.js';
import { config } from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import { withRetry } from '../../../utils/retry.js';

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
});

const BatchResponseSchema = z.record(z.string(), CommentResultSchema);

const SYSTEM_PROMPT = `You are a multilingual sentiment analysis engine for YouTube comments. 
Analyze comments in English, Hindi, and Hinglish (Romanized Hindi mixed with English).
Detect sarcasm and label by INTENDED meaning. Return ONLY valid JSON.
Common Hinglish: yaar, bhai, mast, ekdum, achha, sahi, bohot, toh, hai, kya, bakwas.`;

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY ?? '' });
    this.model = config.OPENAI_MODEL;
  }

  async isAvailable(): Promise<boolean> {
    return !!(config.OPENAI_API_KEY);
  }

  async analyzeBatch(items: BatchItem[], _promptVersion: string): Promise<BatchResult[]> {
    if (items.length === 0) return [];

    const commentsList = items
      .map((item) => `"${item.id}": ${JSON.stringify(item.text)}`)
      .join('\n');

    const userPrompt = `Analyze the sentiment of these ${items.length} comments and return a JSON object keyed by comment ID.

Comments:
${commentsList}

Return this exact schema for each comment ID:
{
  "cXXX": {
    "sentiment": "positive|negative|neutral",
    "score": -1.0 to 1.0,
    "confidence": 0.0 to 1.0,
    "emotion": "joy|anger|sadness|fear|surprise|disgust|trust|anticipation|none",
    "language": "en|hi|hinglish|other",
    "isSarcastic": boolean,
    "isMixed": boolean,
    "aspects": [{"aspect": "string", "sentiment": "positive|negative|neutral"}],
    "keywords": ["max 5 strings"],
    "isToxic": boolean
  }
}`;

    try {
      const parsedResponse = await withRetry(async () => {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
        });

        const text = response.choices[0]?.message?.content ?? '{}';
        const raw = JSON.parse(text);
        return BatchResponseSchema.parse(raw) as Record<string, CommentAnalysis>;
      }, 3, 500);

      return items.map((item) => {
        const result = parsedResponse[item.id];
        if (result) return { id: item.id, result, source: 'llm' as const };
        return { id: item.id, result: analyzeLocally(item.text), source: 'fallback' as const };
      });
    } catch (err) {
      logger.warn({ err }, 'OpenAI batch failed, falling back to local');
      return items.map((item) => ({
        id: item.id,
        result: analyzeLocally(item.text),
        source: 'fallback' as const,
      }));
    }
  }

  async generateInsight(statsJson: string, representativeComments: string[]) {
    const commentsText = representativeComments.slice(0, 30).map((c, i) => `${i + 1}. ${c}`).join('\n');
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You analyze YouTube comment sentiment data and generate executive insights. Return only valid JSON.',
          },
          {
            role: 'user',
            content: `Stats: ${statsJson}\n\nSample comments:\n${commentsText}\n\nReturn JSON: {summary, topPraise[], topComplaints[], recommendedActions[], riskLevel: "low|medium|high", riskReason}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });
      return JSON.parse(response.choices[0]?.message?.content ?? '{}');
    } catch (err) {
      logger.warn({ err }, 'OpenAI insight failed');
      const stats = JSON.parse(statsJson);
      const negPct = stats.sentimentPercentages?.negative ?? 0;
      return {
        summary: `Analysis complete. ${stats.sentimentPercentages?.positive ?? 0}% positive sentiment.`,
        topPraise: ['Content quality'],
        topComplaints: ['Areas for improvement'],
        recommendedActions: ['Review feedback', 'Engage with community'],
        riskLevel: negPct >= 40 ? 'high' : negPct >= 20 ? 'medium' : 'low' as const,
        riskReason: `${negPct.toFixed(0)}% negative comments`,
      };
    }
  }
}
