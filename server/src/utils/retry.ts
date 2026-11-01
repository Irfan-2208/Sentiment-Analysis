/**
 * Generic retry with exponential backoff + jitter.
 * @param fn - async function to retry
 * @param maxAttempts - total attempts (default 3)
 * @param baseDelayMs - initial delay in ms (default 500)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const jitter = Math.random() * baseDelayMs * 0.5;
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates a short stable ID for a comment within a batch (e.g. "c001").
 */
export function shortId(index: number): string {
  return `c${String(index).padStart(3, '0')}`;
}
