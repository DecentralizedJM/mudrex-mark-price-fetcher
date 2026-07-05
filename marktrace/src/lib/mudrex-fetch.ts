export const MUDREX_FETCH_TIMEOUT_MS = Number(process.env.MUDREX_FETCH_TIMEOUT_MS) || 8000;

const MAX_RETRIES = 2;

export class MudrexFetchError extends Error {
  readonly status?: number;

  readonly retryable: boolean;

  constructor(message: string, status?: number, retryable = false) {
    super(message);
    this.name = 'MudrexFetchError';
    this.status = status;
    this.retryable = retryable;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isRetryableNetworkError(err: unknown): boolean {
  if (err instanceof MudrexFetchError) return err.retryable;
  if (err instanceof Error && err.name === 'AbortError') return true;
  return err instanceof TypeError;
}

export async function fetchWithResilience(url: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MUDREX_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (isRetryableStatus(response.status)) {
        if (attempt < MAX_RETRIES) {
          await sleep(2 ** attempt * 500);
          continue;
        }
        throw new MudrexFetchError(
          `Mudrex upstream returned HTTP ${response.status}`,
          response.status,
          true,
        );
      }

      if (!response.ok) {
        throw new MudrexFetchError(
          `Mudrex upstream returned HTTP ${response.status}`,
          response.status,
          false,
        );
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof MudrexFetchError) {
        lastError = err;
        if (err.retryable && attempt < MAX_RETRIES) {
          await sleep(2 ** attempt * 500);
          continue;
        }
        throw err;
      }

      if (isRetryableNetworkError(err) && attempt < MAX_RETRIES) {
        lastError = err;
        await sleep(2 ** attempt * 500);
        continue;
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw new MudrexFetchError(
          `Mudrex request timed out after ${MUDREX_FETCH_TIMEOUT_MS}ms`,
          undefined,
          true,
        );
      }

      throw err;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new MudrexFetchError('Mudrex upstream request failed', undefined, true);
}
