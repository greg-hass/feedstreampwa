import { RETRY_DELAYS, MAX_RETRIES, isRetryableStatus } from "$lib/constants/api";
import { logger } from "$lib/utils/logger";

export interface RetryOptions {
  maxRetries?: number;
  delays?: number[];
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = MAX_RETRIES,
    delays = RETRY_DELAYS,
    onRetry,
    shouldRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        logger.error(`Max retries (${maxRetries}) exceeded`, {
          error: lastError.message,
          attempts: attempt + 1,
        });
        throw lastError;
      }

      const shouldContinue = shouldRetry
        ? shouldRetry(lastError, attempt)
        : isRetryableError(lastError);

      if (!shouldContinue) {
        logger.debug("Non-retryable error, throwing immediately", {
          error: lastError.message,
        });
        throw lastError;
      }

      const delay = delays[Math.min(attempt, delays.length - 1)];
      logger.debug(`Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`, {
        error: lastError.message,
      });

      onRetry?.(attempt + 1, lastError);

      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryableError(error: Error): boolean {
  const errorMessage = error.message.toLowerCase();

  const retryablePatterns = [
    'network',
    'timeout',
    'fetch',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    '5',
  ];

  return (
    retryablePatterns.some((pattern) => errorMessage.includes(pattern)) ||
    error.name === 'TypeError' ||
    error.name === 'AbortError'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions?: RetryOptions
): Promise<Response> {
  return retryWithBackoff(
    async () => {
      const response = await fetch(url, options);
      if (!response.ok && isRetryableStatus(response.status)) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    },
    {
      maxRetries: retryOptions?.maxRetries || 3,
      delays: retryOptions?.delays || RETRY_DELAYS,
      onRetry: retryOptions?.onRetry,
      shouldRetry: retryOptions?.shouldRetry,
    }
  );
}
