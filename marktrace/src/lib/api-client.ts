import type { FetchResult, LookupParams } from './types';

interface ApiError {
  message: string;
}

function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && 'message' in value && !('rows' in value);
}

export async function fetchPriceDataViaApi(
  params: LookupParams,
): Promise<FetchResult | ApiError> {
  const response = await fetch('/api/prices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await response.json()) as FetchResult | ApiError;

  if (!response.ok) {
    return { message: isApiError(data) ? data.message : 'Request failed. Please try again.' };
  }

  return data;
}
