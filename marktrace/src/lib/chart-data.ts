import type { MarkCandle, MergedRow } from './types';

export type ChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ChartSeriesKind = 'mark' | 'ltp';

export function markCandlesToChart(candles: MarkCandle[]): ChartCandle[] {
  return candles.map(([time, open, high, low, close]) => ({
    time,
    open,
    high,
    low,
    close,
  }));
}

export function mergedRowsToChart(rows: MergedRow[], series: ChartSeriesKind): ChartCandle[] {
  return rows
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
    .filter((c): c is ChartCandle => c !== null);
}
