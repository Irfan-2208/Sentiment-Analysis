/**
 * Evaluation runner: tests the active analyzer against the gold set.
 * Usage: npm run eval (in /server)
 * Outputs: accuracy, per-class F1, confusion matrix, sarcasm/Hinglish subsets.
 * Saves report to /server/src/eval/reports/
 */
import { config as dotenvConfig } from 'dotenv';
import { resolve, join } from 'path';
// Load .env from server/ dir (works whether run from root or server/)
dotenvConfig({ path: resolve(__dirname, '../../.env') });
dotenvConfig({ path: resolve(__dirname, '../../../.env') }); // root workspace .env

import { writeFileSync, mkdirSync } from 'fs';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import { analyzeLocally } from '../services/ai/providers/local.js';
import { getProvider } from '../services/ai/providerFactory.js';
import { config } from '../config/index.js';
import goldsetRaw from './goldset.json';

interface GoldItem {
  id: string;
  text: string;
  label: 'positive' | 'negative' | 'neutral';
  tags: string[];
}

type SentimentLabel = 'positive' | 'negative' | 'neutral';

const goldset: GoldItem[] = goldsetRaw as GoldItem[];

async function analyzeWithProvider(texts: string[]): Promise<{ predictions: SentimentLabel[]; fallbackCount: number }> {
  const hasGeminiKey = !!config.GEMINI_API_KEY;
  if (!hasGeminiKey) {
    return {
      predictions: texts.map((t) => analyzeLocally(t).sentiment),
      fallbackCount: 0,
    };
  }

  // Use real AI provider in batches of 45 (3 batches for 125 items, well under 5 RPM)
  const provider = await getProvider();
  const BATCH = 45;
  const results: SentimentLabel[] = [];
  let fallbackCount = 0;

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    process.stdout.write(`\r  Analyzing ${Math.min(i + BATCH, texts.length)}/${texts.length} comments...`);
    try {
      const analysed = await provider.analyzeBatch(
        batch.map((text, idx) => ({
          id: `eval-${i + idx}`,
          text,
        })),
        'v1'
      );
      for (const r of analysed) {
        if (r.source === 'fallback') fallbackCount++;
        results.push(r.result.sentiment as SentimentLabel);
      }
    } catch (err) {
      console.error('\nError analyzing batch with AI provider:', err);
      // Fallback to local for this batch
      for (const text of batch) {
        results.push(analyzeLocally(text).sentiment);
        fallbackCount++;
      }
    }

    if (i + BATCH < texts.length) {
      // Pause 12s between batches to stay under Gemini Free Tier 5 RPM limit
      await new Promise((r) => setTimeout(r, 12000));
    }
  }
  process.stdout.write('\n');

  if (fallbackCount > 0) {
    console.warn(`\n[WARNING] ${fallbackCount}/${texts.length} comments were analyzed by fallback engine.`);
  }

  return { predictions: results, fallbackCount };
}

async function main() {
  try {
    await connectDB();
  } catch {
    // Non-fatal for eval
  }

  console.log('\n=== Social Pulse - Sentiment Evaluation Runner ===');
  console.log('='.repeat(50));
  console.log(`[Gold set] ${goldset.length} comments`);

  const hasGeminiKey = !!config.GEMINI_API_KEY;
  const analyzerLabel = hasGeminiKey
    ? `Gemini (${config.GEMINI_MODEL})`
    : 'Local rule-based (no API key)';
  console.log(`[Analyzer] ${analyzerLabel}`);
  console.log('='.repeat(50));

  // Run analysis
  const texts = goldset.map((g) => g.text);
  const { predictions, fallbackCount } = await analyzeWithProvider(texts);
  const fallbackFraction = fallbackCount / goldset.length;

  const results: Array<{
    id: string;
    text: string;
    actual: SentimentLabel;
    predicted: SentimentLabel;
    tags: string[];
    correct: boolean;
  }> = goldset.map((item, i) => ({
    id: item.id,
    text: item.text,
    actual: item.label,
    predicted: predictions[i],
    tags: item.tags,
    correct: predictions[i] === item.label,
  }));

  // Metrics
  const classes: SentimentLabel[] = ['positive', 'negative', 'neutral'];
  const totalCorrect = results.filter((r) => r.correct).length;
  const accuracy = totalCorrect / results.length;

  console.log(`\n[Accuracy] ${(accuracy * 100).toFixed(1)}% (${totalCorrect}/${results.length})`);

  // Confusion matrix
  const confMatrix: Record<SentimentLabel, Record<SentimentLabel, number>> = {
    positive: { positive: 0, negative: 0, neutral: 0 },
    negative: { positive: 0, negative: 0, neutral: 0 },
    neutral: { positive: 0, negative: 0, neutral: 0 },
  };
  for (const r of results) {
    confMatrix[r.actual][r.predicted]++;
  }

  console.log('\n[Confusion Matrix] (actual -> predicted):');
  console.log('         | positive | negative | neutral');
  console.log('-'.repeat(45));
  for (const actual of classes) {
    const row = classes.map((p) => String(confMatrix[actual][p]).padStart(8)).join(' | ');
    console.log(`${actual.padEnd(8)} | ${row}`);
  }

  // Per-class F1
  console.log('\n[Per-Class Metrics]:');
  const classMetrics: Record<string, { precision: number; recall: number; f1: number; support: number }> = {};
  let macroF1 = 0;

  for (const cls of classes) {
    const tp = confMatrix[cls][cls];
    const fp = classes.filter((c) => c !== cls).reduce((sum, c) => sum + confMatrix[c][cls], 0);
    const fn = classes.filter((c) => c !== cls).reduce((sum, c) => sum + confMatrix[cls][c], 0);
    const support = results.filter((r) => r.actual === cls).length;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    classMetrics[cls] = { precision, recall, f1, support };
    macroF1 += f1;

    console.log(
      `  ${cls.padEnd(9)}: precision=${(precision * 100).toFixed(1)}% recall=${(recall * 100).toFixed(1)}% F1=${(f1 * 100).toFixed(1)}% support=${support}`
    );
  }

  macroF1 /= classes.length;
  console.log(`\n  Macro-F1: ${(macroF1 * 100).toFixed(1)}%`);
  const f1Target = 0.80;
  const passLabel = macroF1 >= f1Target ? 'PASS' : 'BELOW TARGET';
  console.log(`  Target:   ${(f1Target * 100).toFixed(1)}% -- ${passLabel}`);

  // Sarcasm subset
  const sarcasticItems = results.filter((r) => r.tags.includes('sarcasm'));
  const sarcasticCorrect = sarcasticItems.filter((r) => r.correct).length;
  const sarcasticAccuracy = sarcasticItems.length > 0 ? sarcasticCorrect / sarcasticItems.length : 0;

  console.log(`\n[Sarcasm Subset] (n=${sarcasticItems.length}):`);
  console.log(`   Accuracy: ${(sarcasticAccuracy * 100).toFixed(1)}% (${sarcasticCorrect}/${sarcasticItems.length})`);
  const sarcasticErrors = sarcasticItems.filter((r) => !r.correct);
  if (sarcasticErrors.length > 0) {
    console.log('   Errors:');
    sarcasticErrors.slice(0, 5).forEach((e) => {
      console.log(`   - [${e.actual}->${e.predicted}] "${e.text.slice(0, 60)}..."`);
    });
  }

  // Hinglish subset
  const hinglishItems = results.filter((r) => r.tags.includes('hinglish'));
  const hinglishCorrect = hinglishItems.filter((r) => r.correct).length;
  const hinglishAccuracy = hinglishItems.length > 0 ? hinglishCorrect / hinglishItems.length : 0;

  console.log(`\n[Hinglish Subset] (n=${hinglishItems.length}):`);
  console.log(`   Accuracy: ${(hinglishAccuracy * 100).toFixed(1)}% (${hinglishCorrect}/${hinglishItems.length})`);
  const hinglishErrors = hinglishItems.filter((r) => !r.correct);
  if (hinglishErrors.length > 0) {
    console.log('   Errors:');
    hinglishErrors.slice(0, 5).forEach((e) => {
      console.log(`   - [${e.actual}->${e.predicted}] "${e.text.slice(0, 60)}"`);
    });
  }

  // Save report (B2 fix: accurately label analyzer, fallback fraction, and fail if unexpected fallback)
  let realAnalyzerLabel = 'local';
  if (hasGeminiKey) {
    if (fallbackCount === goldset.length) {
      realAnalyzerLabel = 'local-ensemble (100% fallback)';
    } else if (fallbackCount > 0) {
      realAnalyzerLabel = `${config.GEMINI_MODEL} (${fallbackCount}/${goldset.length} fallback)`;
    } else {
      realAnalyzerLabel = config.GEMINI_MODEL;
    }
  }

  const passed = macroF1 >= f1Target && (fallbackCount === 0 || !hasGeminiKey || process.env.ALLOW_EVAL_FALLBACK === 'true');

  const report = {
    timestamp: new Date().toISOString(),
    analyzer: realAnalyzerLabel,
    goldsetSize: goldset.length,
    overallAccuracy: accuracy,
    macroF1,
    target_macroF1: f1Target,
    passed,
    fallbackCount,
    fallbackFraction,
    classMetrics,
    confusionMatrix: confMatrix,
    sarcasticSubset: { n: sarcasticItems.length, accuracy: sarcasticAccuracy },
    hinglishSubset: { n: hinglishItems.length, accuracy: hinglishAccuracy },
    errors: results
      .filter((r) => !r.correct)
      .map((r) => ({ id: r.id, actual: r.actual, predicted: r.predicted, text: r.text.slice(0, 100), tags: r.tags })),
  };

  const reportsDir = join(process.cwd(), 'src/eval/reports');
  mkdirSync(reportsDir, { recursive: true });
  const reportPath = join(reportsDir, `eval_${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`\n[Report] Saved to: ${reportPath}`);
  if (hasGeminiKey && fallbackCount > 0 && process.env.ALLOW_EVAL_FALLBACK !== 'true') {
    console.error(`\n[FAIL] Eval failed: ${fallbackCount}/${goldset.length} comments fell back unexpectedly.`);
  }
  console.log('\n[Done] Evaluation complete!\n');

  try {
    await mongoose.disconnect();
  } catch {}

  process.exit(passed ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
