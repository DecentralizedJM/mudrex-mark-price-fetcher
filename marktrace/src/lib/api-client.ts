import type { FetchResult, LookupParams } from './types';

export interface FetchError {
  message: string;
  retryable: boolean;
}

function isFetchError(value: unknown): value is FetchError {
  return typeof value === 'object' && value !== null && 'message' in value && !('rows' in value);
}

export async function fetchPriceDataViaApi(
  params: LookupParams,
): Promise<FetchResult | FetchError> {
  try {
    const response = await fetch('/api/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = (await response.json()) as FetchResult | FetchError;

    if (!response.ok) {
      const message = isFetchError(data) ? data.message : 'Request failed. Please try again.';
      // 400 = validation / business rules; 429/5xx = transient API issues
      const retryable = response.status === 429 || response.status >= 500;
      return { message, retryable };
    }

    return data;
  } catch {
    return {
      message: 'Network error. Check your connection and try again.',
      retryable: true,
    };
  }
}
