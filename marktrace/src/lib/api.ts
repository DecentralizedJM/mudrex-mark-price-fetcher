import { fetchCandlesChunked } from './api-chunk';
import { normalizeSymbol } from './symbols';
import { localRangeToEpoch, estimateCandleCount } from './time';
import type {
  ApiError,
  FetchResult,
  FetchSummary,
  LookupParams,
  LtpCandle,
  MarkCandle,
  MergedRow,
} from './types';

function mergeCandles(
  ltpCandles: LtpCandle[],
  markCandles: MarkCandle[]
): MergedRow[] {
  const times = new Set<number>();
  ltpCandles.forEach((c) => times.add(c[0]));
  markCandles.forEach((c) => times.add(c[0]));

  const ltpMap = new Map(ltpCandles.map((c) => [c[0], c]));
  const markMap = new Map(markCandles.map((c) => [c[0], c]));

  const sortedTimes = Array.from(times).sort((a, b) => a - b);

  return sortedTimes.map((openTime) => {
    const ltp = ltpMap.get(openTime);
    const mark = markMap.get(openTime);

    return {
      openTime,
      ltp: ltp
        ? {
            open: ltp[1],
            high: ltp[2],
            low: ltp[3],
            close: ltp[4],
            volume: ltp[5],
          }
        : undefined,
      mark: mark
        ? {
            open: mark[1],
            high: mark[2],
            low: mark[3],
            close: mark[4],
          }
        : undefined,
    };
  });
}

function computeSummary(rows: MergedRow[]): FetchSummary {
  let ltpMinLow: number | null = null;
  let ltpMaxHigh: number | null = null;
  let markMinLow: number | null = null;
  let markMaxHigh: number | null = null;
  let maxMarkLtpGap: number | null = null;
  let maxMarkLtpGapPct: number | null = null;
  let maxMarkLtpGapTime: number | null = null;

  for (const row of rows) {
    if (row.ltp) {
      ltpMinLow = ltpMinLow === null ? row.ltp.low : Math.min(ltpMinLow, row.ltp.low);
      ltpMaxHigh = ltpMaxHigh === null ? row.ltp.high : Math.max(ltpMaxHigh, row.ltp.high);
    }
    if (row.mark) {
      markMinLow = markMinLow === null ? row.mark.low : Math.min(markMinLow, row.mark.low);
      markMaxHigh = markMaxHigh === null ? row.mark.high : Math.max(markMaxHigh, row.mark.high);
    }
    if (row.ltp && row.mark) {
      const gap = row.mark.close - row.ltp.close;
      const gapPct = row.ltp.close !== 0 ? (Math.abs(gap) / row.ltp.close) * 100 : 0;
      if (maxMarkLtpGapPct === null || gapPct > maxMarkLtpGapPct) {
        maxMarkLtpGap = gap;
        maxMarkLtpGapPct = gapPct;
        maxMarkLtpGapTime = row.openTime;
      }
    }
  }

  return {
    rowCount: rows.length,
    ltpMinLow,
    ltpMaxHigh,
    markMinLow,
    markMaxHigh,
    maxMarkLtpGap,
    maxMarkLtpGapPct,
    maxMarkLtpGapTime,
  };
}

export function validateLookup(params: LookupParams): string | null {
  if (!params.symbol.trim()) return 'Symbol is required.';
  if (!params.startTime) return 'Start date & time is required.';
  if (!params.endTime) return 'End date & time is required.';

  const { start, end } = localRangeToEpoch(
    params.startTime,
    params.endTime,
    params.timezone
  );

  if (end <= start) return 'End time must be after start time.';

  const candleCount = estimateCandleCount(start, end, params.aggregation);
  if (candleCount > 1440 * 24) {
    return 'Range is too large. Please narrow the time window.';
  }

  return null;
}

export function getRangeWarning(params: LookupParams): string | null {
  if (!params.startTime || !params.endTime) return null;
  const { start, end } = localRangeToEpoch(params.startTime, params.endTime, params.timezone);
  const candleCount = estimateCandleCount(start, end, params.aggregation);
  if (candleCount > 1440) {
    return `This range may produce ~${candleCount} candles at ${params.aggregation}. Requests will be auto-chunked.`;
  }
  if (end - start > 86400) {
    return 'Range exceeds 24 hours. Consider narrowing for faster results.';
  }
  return null;
}

export async function fetchPriceData(params: LookupParams): Promise<FetchResult | ApiError> {
  const validationError = validateLookup(params);
  if (validationError) {
    return { message: validationError };
  }

  let normalizedSymbol: string;
  try {
    normalizedSymbol = normalizeSymbol(params.symbol);
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Invalid symbol format.' };
  }

  const { start, end } = localRangeToEpoch(
    params.startTime,
    params.endTime,
    params.timezone
  );

  try {
    const [ltpCandles, markCandles] = await Promise.all([
      fetchCandlesChunked('kline', normalizedSymbol, params.aggregation, start, end),
      fetchCandlesChunked('mark-kline', normalizedSymbol, params.aggregation, start, end),
    ]);

    const rows = mergeCandles(
      ltpCandles as LtpCandle[],
      markCandles as MarkCandle[]
    );

    if (rows.length === 0) {
      return { message: 'No data returned for this symbol and time range.' };
    }

    return {
      symbol: params.symbol,
      normalizedSymbol,
      rows,
      summary: computeSummary(rows),
      fetchStart: start,
      fetchEnd: end,
    };
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to fetch price data.' };
  }
}
