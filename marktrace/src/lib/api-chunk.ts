import type { Aggregation } from './types';

export const MAX_CANDLES = 1440;
const BASE_URL = 'https://trade.mudrex.com/fapi/v1/price';

export function aggregationToSeconds(aggregation: Aggregation): number {
  switch (aggregation) {
    case '1m':
      return 60;
    case '3t':
      return 180;
    case '5t':
      return 300;
    case '15t':
      return 900;
    case '30t':
      return 1800;
    case '1h':
      return 3600;
    default:
      return 60;
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  errors?: { code: string; text: string }[];
}

interface KlineResponse {
  asset_ticks: Record<string, number[][]>;
}

function buildUrl(endpoint: 'kline' | 'mark-kline', params: Record<string, string>): string {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

async function fetchEndpoint(
  endpoint: 'kline' | 'mark-kline',
  symbol: string,
  aggregation: Aggregation,
  startTime: number,
  endTime: number,
): Promise<number[][]> {
  const url = buildUrl(endpoint, {
    assets: symbol,
    aggregation,
    start_time: String(startTime),
    end_time: String(endTime),
  });

  const response = await fetch(url);
  const json = (await response.json()) as ApiEnvelope<KlineResponse>;

  if (!json.success) {
    const message = json.errors?.[0]?.text ?? `Failed to fetch ${endpoint}`;
    throw new Error(message);
  }

  const key = symbol.toLowerCase();
  return json.data?.asset_ticks?.[key] ?? [];
}

function dedupeByOpenTime(candles: number[][]): number[][] {
  const map = new Map<number, number[]>();
  for (const candle of candles) {
    map.set(candle[0], candle);
  }
  return Array.from(map.values()).sort((a, b) => a[0] - b[0]);
}

export async function fetchCandlesChunked(
  endpoint: 'kline' | 'mark-kline',
  symbol: string,
  aggregation: Aggregation,
  startTime: number,
  endTime: number,
): Promise<number[][]> {
  const step = aggregationToSeconds(aggregation);
  const maxWindow = MAX_CANDLES * step;
  const totalSpan = endTime - startTime;

  if (totalSpan <= 0) {
    return [];
  }

  if (totalSpan <= maxWindow) {
    return fetchEndpoint(endpoint, symbol, aggregation, startTime, endTime);
  }

  const chunks: number[][][] = [];
  let cursor = startTime;

  while (cursor < endTime) {
    const chunkEnd = Math.min(cursor + maxWindow, endTime);
    const chunk = await fetchEndpoint(endpoint, symbol, aggregation, cursor, chunkEnd);
    chunks.push(chunk);
    cursor = chunkEnd;
  }

  return dedupeByOpenTime(chunks.flat());
}
