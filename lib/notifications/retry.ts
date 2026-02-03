export type RetryOptions = {
  retries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
};

export async function retry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const maxDelay = opts.maxDelayMs ?? 10_000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt >= opts.retries) break;

      const exp = Math.min(maxDelay, opts.baseDelayMs * Math.pow(2, attempt));
      const jitter = Math.floor(Math.random() * 250);
      await new Promise((r) => setTimeout(r, exp + jitter));
    }
  }

  throw lastError;
}

export function isTransientHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}
