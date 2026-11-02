import type { Platform } from '@social-pulse/shared';
import type { SourceAdapter, SourceInput } from './types.js';
import { YouTubeAdapter } from './youtubeAdapter.js';
import { FlipkartCsvAdapter } from './flipkartCsvAdapter.js';
import { FlipkartProviderAdapter } from './flipkartProviderAdapter.js';

const youtubeAdapter = new YouTubeAdapter();
const flipkartCsvAdapter = new FlipkartCsvAdapter();
const flipkartProviderAdapter = new FlipkartProviderAdapter();

export function getSourceAdapter(platform: Platform = 'youtube', forceProvider = false): SourceAdapter<SourceInput> {
  if (platform === 'youtube') {
    return youtubeAdapter;
  }

  if (platform === 'flipkart') {
    const providerConfig = (process.env.FLIPKART_PROVIDER || 'none').toLowerCase();
    if (forceProvider || providerConfig !== 'none') {
      return flipkartProviderAdapter;
    }
    return flipkartCsvAdapter;
  }

  return youtubeAdapter;
}

export { YouTubeAdapter, FlipkartCsvAdapter, FlipkartProviderAdapter };
export * from './types.js';
