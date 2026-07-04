import type { MarkCandle, MergedRow } from './types';

export type ChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ChartSeriesKind = 'mark' | 'ltp';

export type ChartPriceFormat = {
  precision: number;
  minMove: number;
};

function decimalPlaces(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = value.toString();
  if (!text.includes('.')) return 0;
  const fraction = text.split('.')[1]?.replace(/0+$/, '') ?? '';
  return fraction.length;
}

/** Pick axis precision from candle/overlay prices (default 2dp breaks sub-dollar tokens). */
export function inferPriceFormat(values: number[]): ChartPriceFormat {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length === 0) {
    return { precision: 2, minMove: 0.01 };
  }

  const maxRef = Math.max(...valid.map((v) => decimalPlaces(v)));
  const precision = Math.min(8, Math.max(2, maxRef));
  const minMove = Number(Math.pow(10, -precision).toFixed(precision));

  return { precision, minMove };
}

export function collectChartPrices(
  candles: ChartCandle[],
  overlayPrices: number[] = [],
): number[] {
  const prices: number[] = [...overlayPrices];
  for (const c of candles) {
    prices.push(c.open, c.high, c.low, c.close);
  }
  return prices;
}

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
