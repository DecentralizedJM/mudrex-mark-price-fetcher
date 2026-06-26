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
  markCandles: MarkCandle[],
  coreStart: number,
  coreEnd: number,
  referenceEpoch?: number,
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
    const isBuffer = openTime < coreStart || openTime > coreEnd;

    let label: string | undefined;
    if (referenceEpoch !== undefined) {
      const diffMinutes = Math.round((openTime - referenceEpoch) / 60);
      if (diffMinutes === 0) label = 'T';
      else if (diffMinutes > 0) label = `T+${diffMinutes}`;
      else label = `T${diffMinutes}`;
    }

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
      isBuffer,
      label,
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
  if (!params.date) return 'Date is required.';
  if (!params.startTime) return 'Start time is required.';
  if (!params.endTime) return 'End time is required.';

  const { coreStart, coreEnd } = localRangeToEpoch(
    params.date,
    params.startTime,
    params.endTime,
    params.timezone,
    0,
  );

  if (coreEnd <= coreStart) return 'End time must be after start time.';

  const candleCount = estimateCandleCount(coreStart, coreEnd, params.aggregation);
  if (candleCount > 1440 * 24) {
    return 'Range is too large. Please narrow the time window.';
  }

  return null;
}

export function getRangeWarning(params: LookupParams): string | null {
  const { coreStart, coreEnd } = localRangeToEpoch(
    params.date,
    params.startTime,
    params.endTime,
    params.timezone,
    0,
  );
  const candleCount = estimateCandleCount(coreStart, coreEnd, params.aggregation);
  if (candleCount > 1440) {
    return `This range may produce ~${candleCount} candles at ${params.aggregation}. Requests will be auto-chunked.`;
  }
  if (coreEnd - coreStart > 86400) {
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

  const { coreStart, coreEnd, fetchStart, fetchEnd } = localRangeToEpoch(
    params.date,
    params.startTime,
    params.endTime,
    params.timezone,
    params.bufferMinutes,
  );

  let referenceEpoch: number | undefined;
  if (params.referenceTime) {
    const ref = localRangeToEpoch(
      params.date,
      params.referenceTime,
      params.referenceTime,
      params.timezone,
      0,
    );
    referenceEpoch = ref.coreStart;
  }

  try {
    const [ltpCandles, markCandles] = await Promise.all([
      fetchCandlesChunked('kline', normalizedSymbol, params.aggregation, fetchStart, fetchEnd),
      fetchCandlesChunked('mark-kline', normalizedSymbol, params.aggregation, fetchStart, fetchEnd),
    ]);

    const rows = mergeCandles(
      ltpCandles as LtpCandle[],
      markCandles as MarkCandle[],
      coreStart,
      coreEnd,
      referenceEpoch,
    );

    if (rows.length === 0) {
      return { message: 'No data returned for this symbol and time range.' };
    }

    return {
      symbol: params.symbol,
      normalizedSymbol,
      rows,
      summary: computeSummary(rows),
      coreStart,
      coreEnd,
      fetchStart,
      fetchEnd,
    };
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to fetch price data.' };
  }
}
