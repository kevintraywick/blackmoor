import Anthropic from '@anthropic-ai/sdk';

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 529]);

function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof Anthropic.RateLimitError) return true;
  if (error instanceof Anthropic.InternalServerError) return true;
  if (error instanceof Anthropic.APIConnectionError) return true;
  if (error instanceof Anthropic.APIConnectionTimeoutError) return true;

  if (error instanceof Error) {
    if (error.name === 'AbortError') return true;
    if (error.message.includes('fetch failed')) return true;
  }

  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: number }).status;
    if (RETRYABLE_STATUSES.has(status)) return true;
  }

  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions,
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 3;
  const baseDelayMs = opts?.baseDelayMs ?? 1000;
  const isRetryable = opts?.isRetryable ?? defaultIsRetryable;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts || !isRetryable(error)) {
        throw error;
      }

      const jitter = Math.random() * 0.5 + 0.75;
      const delay = baseDelayMs * Math.pow(2, attempt - 1) * jitter;
      console.warn(`withRetry: attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(delay)}ms`, error instanceof Error ? error.message : String(error));
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
