import type { AIProvider } from './provider.js';
import { GeminiProvider } from './providers/gemini.js';
import { OpenAIProvider } from './providers/openai.js';
import { LocalProvider } from './providers/local.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

let _provider: AIProvider | null = null;

/**
 * Returns the appropriate AI provider based on config.
 * Falls back to LocalProvider if the configured provider is unavailable.
 */
export async function getProvider(): Promise<AIProvider> {
  if (_provider) return _provider;

  // If ensemble mode is explicitly configured, use LocalProvider directly
  if (config.ANALYSIS_MODE === 'ensemble') {
    logger.info('ANALYSIS_MODE=ensemble configured, using local ensemble provider');
    _provider = new LocalProvider();
    return _provider;
  }

  const requestedProvider = config.AI_PROVIDER;

  if (requestedProvider === 'gemini' && config.GEMINI_API_KEY) {
    const provider = new GeminiProvider();
    const available = await provider.isAvailable();
    if (available) {
      logger.info({ provider: 'gemini', model: config.GEMINI_MODEL }, 'Using Gemini provider');
      _provider = provider;
      return _provider;
    }
    logger.warn('Gemini API key present but provider unavailable, falling back to local');
  }

  if (requestedProvider === 'openai' && config.OPENAI_API_KEY) {
    const provider = new OpenAIProvider();
    const available = await provider.isAvailable();
    if (available) {
      logger.info({ provider: 'openai', model: config.OPENAI_MODEL }, 'Using OpenAI provider');
      _provider = provider;
      return _provider;
    }
    logger.warn('OpenAI API key present but provider unavailable, falling back to local');
  }

  // Fallback to local
  logger.info({ reason: requestedProvider === 'local' ? 'configured' : 'no API key' }, 'Using local rule-based provider');
  _provider = new LocalProvider();
  return _provider;
}

/**
 * Resets the provider cache (for testing).
 */
export function resetProvider(): void {
  _provider = null;
}
