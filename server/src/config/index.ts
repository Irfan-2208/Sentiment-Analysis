import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000').transform(Number),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/socialpulse'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  // YouTube
  YOUTUBE_API_KEY: z.string().optional(),

  // AI
  AI_PROVIDER: z.enum(['gemini', 'openai', 'local']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  GEMINI_FALLBACK_MODELS: z
    .string()
    .default('gemini-1.5-flash,gemini-1.5-pro')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  GEMINI_RPM: z.string().default('5').transform(Number),
  ANALYSIS_MODE: z.enum(['hybrid', 'llm', 'ensemble']).default('hybrid'),
  NLP_SERVICE_URL: z.string().default('http://localhost:8000'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // Demo
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  // Pipeline
  BATCH_SIZE: z.string().default('25').transform(Number),
  AI_CONCURRENCY: z.string().default('3').transform(Number),
  MAX_COMMENTS_LIMIT: z.string().default('100000').transform(Number),

  // Logging
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

// Auto-enable demo mode when no YouTube key is provided
const isDemoMode = raw.DEMO_MODE || !raw.YOUTUBE_API_KEY;

export const config = {
  ...raw,
  IS_DEMO: isDemoMode,
  PROMPT_VERSION: '1.0.0',
} as const;

export type Config = typeof config;
