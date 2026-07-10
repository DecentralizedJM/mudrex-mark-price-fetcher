import type { MarkCandle } from '../src/lib/types.ts';

export type PeerExchangeId = 'bybit' | 'binance' | 'delta';
export type PeerLiquidationSide = 'Long' | 'Short';

export const PEER_EXCHANGE_IDS: PeerExchangeId[] = ['bybit', 'binance', 'delta'];

export const PEER_EXCHANGE_LABELS: Record<PeerExchangeId, string> = {
  bybit: 'Bybit',
  binance: 'Binance',
  delta: 'Delta Exchange',
};

const FETCH_TIMEOUT_MS = 12_000;

export type PeerMarkResult =
  | {
      exchange: PeerExchangeId;
      status: 'ok';
      candles: MarkCandle[];
      extremeMark: number;
      extremeTime: number;
      markOpen: number;
      markClose: number;
      markMovePct: number;
      crossedLiq: boolean;
    }
  | {
      exchange: PeerExchangeId;
      status: 'not_listed' | 'error';
      message: string;
    };

function compactSymbol(normalizedSymbol: string): string {
  return normalizedSymbol.replace('/', '').toUpperCase();
}

/** Delta India perpetuals use MARK:BASEUSD (e.g. BTC/USDT → MARK:BTCUSD). */
function deltaMarkSymbol(normalizedSymbol: string): string {
  const [base] = normalizedSymbol.split('/');
  return `MARK:${base}USD`;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } finally {
    clearTimeout(timer);
  }
}

function toMarkCandlesFromOhlc(
  rows: Array<{ openTimeSec: number; open: number; high: number; low: number; close: number }>,
): MarkCandle[] {
  return rows
    .filter((r) => Number.isFinite(r.openTimeSec))
    .sort((a, b) => a.openTimeSec - b.openTimeSec)
    .map((r) => [r.openTimeSec, r.open, r.high, r.low, r.close] as MarkCandle);
}

function pctFrom(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

export function computePeerMarkStats(
  candles: MarkCandle[],
  side: PeerLiquidationSide,
  liquidationPrice: number,
): {
  extremeMark: number;
  extremeTime: number;
  markOpen: number;
  markClose: number;
  markMovePct: number;
  crossedLiq: boolean;
} | null {
  if (candles.length === 0) return null;

  const markOpen = candles[0][1];
  const markClose = candles[candles.length - 1][4];
  const markMovePct = pctFrom(markOpen, markClose);

  let extremeMark: number | null = null;
  let extremeTime: number | null = null;

  for (const candle of candles) {
    const val = side === 'Long' ? candle[3] : candle[2];
    if (
      extremeMark === null ||
      (side === 'Long' ? val < extremeMark : val > extremeMark)
    ) {
      extremeMark = val;
      extremeTime = candle[0];
    }
  }

  if (extremeMark === null || extremeTime === null) return null;

  const crossedLiq =
    side === 'Long' ? extremeMark <= liquidationPrice : extremeMark >= liquidationPrice;

  return { extremeMark, extremeTime, markOpen, markClose, markMovePct, crossedLiq };
}

async function fetchBybitMarkKlines(
  normalizedSymbol: string,
  windowStartSec: number,
  windowEndSec: number,
): Promise<MarkCandle[]> {
  const symbol = compactSymbol(normalizedSymbol);
  const url = new URL('https://api.bybit.com/v5/market/mark-price-kline');
  url.searchParams.set('category', 'linear');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', '1');
  url.searchParams.set('start', String(windowStartSec * 1000));
  url.searchParams.set('end', String(windowEndSec * 1000));
  url.searchParams.set('limit', '200');

  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`Bybit HTTP ${response.status}`);
  }

  const json = (await response.json()) as {
    retCode?: number;
    retMsg?: string;
    result?: { list?: string[][] };
  };

  if (json.retCode !== 0) {
    const msg = json.retMsg ?? 'Bybit error';
    if (/not found|invalid symbol|symbol invalid/i.test(msg)) return [];
    throw new Error(msg);
  }

  const list = json.result?.list ?? [];
  const rows = list.map((row) => ({
    openTimeSec: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  }));

  return toMarkCandlesFromOhlc(rows);
}

async function fetchBinanceMarkKlines(
  normalizedSymbol: string,
  windowStartSec: number,
  windowEndSec: number,
): Promise<MarkCandle[]> {
  const symbol = compactSymbol(normalizedSymbol);
  const url = new URL('https://fapi.binance.com/fapi/v1/markPriceKlines');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', '1m');
  url.searchParams.set('startTime', String(windowStartSec * 1000));
  url.searchParams.set('endTime', String(windowEndSec * 1000));
  url.searchParams.set('limit', '1000');

  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) {
    if (response.status === 400 || response.status === 404) return [];
    throw new Error(`Binance HTTP ${response.status}`);
  }

  const json = (await response.json()) as unknown;

  if (!Array.isArray(json)) {
    const err = json as { code?: number; msg?: string };
    if (err.code === -1121 || /invalid symbol/i.test(err.msg ?? '')) return [];
    throw new Error(err.msg ?? 'Binance error');
  }

  const rows = (json as string[][]).map((row) => ({
    openTimeSec: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  }));

  return toMarkCandlesFromOhlc(rows);
}

async function fetchDeltaMarkKlines(
  normalizedSymbol: string,
  windowStartSec: number,
  windowEndSec: number,
): Promise<MarkCandle[]> {
  const symbol = deltaMarkSymbol(normalizedSymbol);
  const url = new URL('https://api.india.delta.exchange/v2/history/candles');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('resolution', '1m');
  url.searchParams.set('start', String(windowStartSec));
  url.searchParams.set('end', String(windowEndSec));

  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`Delta HTTP ${response.status}`);
  }

  const json = (await response.json()) as {
    success?: boolean;
    error?: { code?: string; message?: string };
    result?: Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
    }>;
  };

  if (json.success === false) {
    const msg = json.error?.message ?? 'Delta error';
    if (/not found|invalid|unknown symbol/i.test(msg)) return [];
    throw new Error(msg);
  }

  const result = json.result ?? [];
  const rows = result.map((c) => ({
    openTimeSec: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));

  return toMarkCandlesFromOhlc(rows);
}

async function fetchPeerMarkKlines(
  exchange: PeerExchangeId,
  normalizedSymbol: string,
  windowStartSec: number,
  windowEndSec: number,
): Promise<MarkCandle[]> {
  switch (exchange) {
    case 'bybit':
      return fetchBybitMarkKlines(normalizedSymbol, windowStartSec, windowEndSec);
    case 'binance':
      return fetchBinanceMarkKlines(normalizedSymbol, windowStartSec, windowEndSec);
    case 'delta':
      return fetchDeltaMarkKlines(normalizedSymbol, windowStartSec, windowEndSec);
    default:
      return [];
  }
}

export async function fetchPeerExchangeMark(
  exchange: PeerExchangeId,
  normalizedSymbol: string,
  windowStartSec: number,
  windowEndSec: number,
  side: PeerLiquidationSide,
  liquidationPrice: number,
): Promise<PeerMarkResult> {
  try {
    const candles = await fetchPeerMarkKlines(
      exchange,
      normalizedSymbol,
      windowStartSec,
      windowEndSec,
    );

    if (candles.length === 0) {
      return {
        exchange,
        status: 'not_listed',
        message: `${PEER_EXCHANGE_LABELS[exchange]} has no mark price data for this symbol in the window.`,
      };
    }

    const stats = computePeerMarkStats(candles, side, liquidationPrice);
    if (!stats) {
      return {
        exchange,
        status: 'error',
        message: `${PEER_EXCHANGE_LABELS[exchange]} returned unusable mark candles.`,
      };
    }

    return {
      exchange,
      status: 'ok',
      candles,
      ...stats,
    };
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? `${PEER_EXCHANGE_LABELS[exchange]} request timed out.`
        : err instanceof Error
          ? err.message
          : `${PEER_EXCHANGE_LABELS[exchange]} fetch failed.`;
    return { exchange, status: 'error', message };
  }
}

export async function fetchPeerExchangesMark(
  exchanges: PeerExchangeId[],
  normalizedSymbol: string,
  windowStartSec: number,
  windowEndSec: number,
  side: PeerLiquidationSide,
  liquidationPrice: number,
): Promise<PeerMarkResult[]> {
  const unique = [...new Set(exchanges)];
  const settled = await Promise.allSettled(
    unique.map((exchange) =>
      fetchPeerExchangeMark(
        exchange,
        normalizedSymbol,
        windowStartSec,
        windowEndSec,
        side,
        liquidationPrice,
      ),
    ),
  );

  return settled.map((outcome, i) => {
    const exchange = unique[i];
    if (outcome.status === 'fulfilled') return outcome.value;
    return {
      exchange,
      status: 'error' as const,
      message: outcome.reason instanceof Error ? outcome.reason.message : 'Fetch failed.',
    };
  });
}

export function isPeerExchangeId(value: string): value is PeerExchangeId {
  return PEER_EXCHANGE_IDS.includes(value as PeerExchangeId);
}
