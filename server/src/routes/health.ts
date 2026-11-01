import { Router, Request, Response } from 'express';
import { checkDBHealth } from '../config/database.js';
import { config } from '../config/index.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const dbHealthy = await checkDBHealth();
  const aiProviderConfigured =
    (config.AI_PROVIDER === 'gemini' && !!config.GEMINI_API_KEY) ||
    (config.AI_PROVIDER === 'openai' && !!config.OPENAI_API_KEY) ||
    config.AI_PROVIDER === 'local';

  const status = dbHealthy ? 'ok' : 'degraded';

  res.status(dbHealthy ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    demo: config.IS_DEMO,
    checks: {
      database: dbHealthy ? 'ok' : 'error',
      aiProvider: config.AI_PROVIDER,
      aiProviderConfigured,
      youtubeKeyPresent: !!config.YOUTUBE_API_KEY,
      promptVersion: config.PROMPT_VERSION,
    },
  });
});
