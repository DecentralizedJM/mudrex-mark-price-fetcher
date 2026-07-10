import { useMemo, useState } from 'react';
import { mergedRowsToChart, type ChartSeriesKind } from '../lib/chart-data';
import type { MergedRow, TimezoneId } from '../lib/types';
import { PriceChart } from './PriceChart';

interface LookupPriceChartProps {
  rows: MergedRow[];
  symbol: string;
  timezone: TimezoneId;
}

export function LookupPriceChart({ rows, symbol, timezone }: LookupPriceChartProps) {
  const [series, setSeries] = useState<ChartSeriesKind>('mark');

  const candles = useMemo(() => mergedRowsToChart(rows, series), [rows, series]);

  const seriesLabel = series === 'mark' ? 'Mark price' : 'LTP';

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="meta-label">Chart series</span>
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          <button
            type="button"
            onClick={() => setSeries('mark')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              series === 'mark'
                ? 'border border-primary-border bg-primary-subtle text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Mark
          </button>
          <button
            type="button"
            onClick={() => setSeries('ltp')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              series === 'ltp'
                ? 'border border-primary-border bg-primary-subtle text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            LTP
          </button>
        </div>
      </div>

      <PriceChart
        candles={candles}
        title={`${seriesLabel} candlesticks`}
        subtitle={`Mudrex ${series === 'mark' ? 'mark-kline' : 'kline'} data for the selected range.`}
        timezone={timezone}
        exportFilename={`lookup-${series}-${symbol.replace('/', '-') || 'chart'}`}
      />
    </div>
  );
}
