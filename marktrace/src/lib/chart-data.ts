import type { MarkCandle, MergedRow } from './types';

export type ChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ChartSeriesKind = 'mark' | 'ltp';

function isValidCandle(c: ChartCandle): boolean {
  return [c.open, c.high, c.low, c.close].every(
    (v) => Number.isFinite(v) && v > 0,
  );
}

function normalizeCandles(candles: ChartCandle[]): ChartCandle[] {
  const byTime = new Map<number, ChartCandle>();
  for (const candle of candles) {
    if (!isValidCandle(candle)) continue;
    byTime.set(candle.time, candle);
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

export function markCandlesToChart(candles: MarkCandle[]): ChartCandle[] {
  return normalizeCandles(
    candles.map(([time, open, high, low, close]) => ({
      time,
      open,
      high,
      low,
      close,
    })),
  );
}

export function mergedRowsToChart(rows: MergedRow[], series: ChartSeriesKind): ChartCandle[] {
  return normalizeCandles(
    rows
      .map((row) => {
        const ohlc = series === 'mark' ? row.mark : row.ltp;
        if (!ohlc) return null;
        return {
          time: row.openTime,
          open: ohlc.open,
          high: ohlc.high,
          low: ohlc.low,
          close: ohlc.close,
        };
      })
      .filter((c): c is ChartCandle => c !== null),
  );
}
