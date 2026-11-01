import type {
  AnalysisStats,
  SentimentCounts,
  TimePoint,
  KeywordStat,
  AspectStat,
  EmotionStat,
  LanguageStat,
} from '@social-pulse/shared';
import { Comment } from '../../models/Comment.js';
import mongoose from 'mongoose';

/**
 * Computes all aggregated statistics from Comment documents for a given analysisId.
 */
export async function computeStats(
  analysisId: mongoose.Types.ObjectId,
  totalFetched: number,
  totalDeduplicated: number,
  totalSpamRemoved: number
): Promise<AnalysisStats> {
  const comments = await Comment.find({
    analysisId,
    isSpam: false,
    isDuplicateOf: null,
    analysis: { $ne: null },
  }).lean();

  const totalAnalyzed = comments.length;
  const totalFallback = comments.filter((c) => c.source === 'fallback').length;

  // ── Sentiment counts & percentages ────────────────────────
  const sentimentCounts: SentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  let scoreSum = 0;
  let sarcasticCount = 0;
  let toxicCount = 0;
  let mixedCount = 0;
  let totalWeight = 0;

  const keywordMap = new Map<string, KeywordStat>();
  const aspectMap = new Map<string, AspectStat>();
  const emotionMap = new Map<string, number>();
  const languageMap = new Map<string, number>();
  const timeMap = new Map<string, TimePoint>();

  for (const comment of comments) {
    const a = comment.analysis;
    if (!a) continue;

    // Use override if set
    const effectiveSentiment = comment.userOverride?.sentiment ?? a.sentiment;
    // B6 fix: weight canonical comments by (duplicateCount + 1) to reflect full audience volume
    const weight = (comment.duplicateCount ?? 0) + 1;
    totalWeight += weight;

    sentimentCounts[effectiveSentiment] += weight;
    scoreSum += a.score * weight;
    if (a.isSarcastic) sarcasticCount += weight;
    if (a.isToxic) toxicCount += weight;
    if (a.isMixed) mixedCount += weight;

    // Keywords
    for (const kw of (a.keywords ?? [])) {
      const key = kw.toLowerCase();
      const existing = keywordMap.get(key) ?? { keyword: key, count: 0, positive: 0, negative: 0, neutral: 0 };
      existing.count += weight;
      existing[effectiveSentiment] += weight;
      keywordMap.set(key, existing);
    }

    // Aspects
    for (const asp of (a.aspects ?? [])) {
      const key = asp.aspect.toLowerCase();
      const existing = aspectMap.get(key) ?? { aspect: key, positive: 0, negative: 0, neutral: 0, total: 0 };
      existing[asp.sentiment] += weight;
      existing.total += weight;
      aspectMap.set(key, existing);
    }

    // Emotions
    const emo = a.emotion ?? 'none';
    emotionMap.set(emo, (emotionMap.get(emo) ?? 0) + weight);

    // Languages
    const lang = a.language ?? 'en';
    languageMap.set(lang, (languageMap.get(lang) ?? 0) + weight);

    // Time bucketing
    if (comment.publishedAt) {
      const bucket = bucketDate(comment.publishedAt, comments.length);
      const existing = timeMap.get(bucket) ?? { bucket, positive: 0, negative: 0, neutral: 0, total: 0 };
      existing[effectiveSentiment] += weight;
      existing.total += weight;
      timeMap.set(bucket, existing);
    }
  }

  const sentimentPercentages: SentimentCounts = {
    positive: totalWeight > 0 ? Math.round((sentimentCounts.positive / totalWeight) * 100) : 0,
    negative: totalWeight > 0 ? Math.round((sentimentCounts.negative / totalWeight) * 100) : 0,
    neutral: totalWeight > 0 ? Math.round((sentimentCounts.neutral / totalWeight) * 100) : 0,
  };

  const averageScore = totalWeight > 0 ? Math.round((scoreSum / totalWeight) * 1000) / 1000 : 0;

  // ── Top keywords ──────────────────────────────────────────
  const topKeywords: KeywordStat[] = [...keywordMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // ── Aspect stats ──────────────────────────────────────────
  const aspectStats: AspectStat[] = [...aspectMap.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  // ── Emotion distribution ──────────────────────────────────
  const emotionDistribution: EmotionStat[] = [...emotionMap.entries()]
    .map(([emotion, count]) => ({ emotion: emotion as EmotionStat['emotion'], count }))
    .sort((a, b) => b.count - a.count);

  // ── Language distribution ─────────────────────────────────
  const languageDistribution: LanguageStat[] = [...languageMap.entries()]
    .map(([language, count]) => ({ language: language as LanguageStat['language'], count }))
    .sort((a, b) => b.count - a.count);

  // ── Sentiment over time ───────────────────────────────────
  const sentimentOverTime: TimePoint[] = [...timeMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, point]) => point);

  return {
    totalFetched,
    totalDeduplicated,
    totalSpamRemoved,
    totalAnalyzed,
    totalFallback,
    sentimentCounts,
    sentimentPercentages,
    averageScore,
    sarcasticCount,
    toxicCount,
    mixedCount,
    sentimentOverTime,
    topKeywords,
    aspectStats,
    emotionDistribution,
    languageDistribution,
  };
}

/**
 * Buckets a date string by day or hour depending on comment count.
 */
function bucketDate(publishedAt: string, totalComments: number): string {
  const date = new Date(publishedAt);
  if (isNaN(date.getTime())) return 'unknown';

  // Use hourly buckets if spread is < 1 day, daily otherwise
  if (totalComments < 100) {
    // Hourly
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:00`;
  }
  // Daily
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Fetches top N most-liked comments for a given sentiment.
 */
export async function getTopLikedComments(
  analysisId: mongoose.Types.ObjectId,
  sentiment: 'positive' | 'negative',
  limit = 10
) {
  return Comment.find({
    analysisId,
    isSpam: false,
    isDuplicateOf: null,
    'analysis.sentiment': sentiment,
  })
    .sort({ likeCount: -1 })
    .limit(limit)
    .lean();
}
