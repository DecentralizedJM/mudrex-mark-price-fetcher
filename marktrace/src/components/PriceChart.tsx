import { useCallback, useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { Download } from 'lucide-react';
import type { ChartCandle } from '../lib/chart-data';
import {
  buildCandlestickSeriesOptions,
  buildChartOptions,
  getChartTheme,
} from '../lib/chart-theme';
import { Button } from './ui/Button';

const EMPTY_PRICE_LINES: PriceLineOverlay[] = [];
const EMPTY_MARKERS: ChartMarkerInput[] = [];

export type PriceLineOverlay = {
  price: number;
  title: string;
  color?: string;
};

export type ChartMarkerInput = {
  time: number;
  text: string;
  position?: 'aboveBar' | 'belowBar';
  color?: string;
  shape?: 'arrowDown' | 'arrowUp' | 'circle';
};

export interface PriceChartProps {
  candles: ChartCandle[];
  title?: string;
  subtitle?: string;
  priceLines?: PriceLineOverlay[];
  markers?: ChartMarkerInput[];
  height?: number;
  showExport?: boolean;
  exportFilename?: string;
  className?: string;
}

function toSeriesData(candles: ChartCandle[]) {
  return candles.map((c) => ({
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

function toSeriesMarkers(markers: ChartMarkerInput[]): SeriesMarker<Time>[] {
  const theme = getChartTheme();
  return markers.map((m) => ({
    time: m.time as UTCTimestamp,
    position: m.position ?? 'aboveBar',
    color: m.color ?? theme.primary,
    shape: m.shape ?? 'circle',
    text: m.text,
  }));
}

export function PriceChart({
  candles,
  title,
  subtitle,
  priceLines = EMPTY_PRICE_LINES,
  markers = EMPTY_MARKERS,
  height = 320,
  showExport = true,
  exportFilename = 'price-chart',
  className = '',
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLineRefs = useRef<IPriceLine[]>([]);

  const applyTheme = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const theme = getChartTheme();
    chart.applyOptions(buildChartOptions(theme));
    series.applyOptions(buildCandlestickSeriesOptions(theme));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const theme = getChartTheme();
    const chart = createChart(container, {
      ...buildChartOptions(theme),
      width: container.clientWidth,
      height,
    });

    const series = chart.addSeries(CandlestickSeries, buildCandlestickSeriesOptions(theme));
    markersPluginRef.current = createSeriesMarkers(series);

    chartRef.current = chart;
    seriesRef.current = series;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && chartRef.current) {
        chartRef.current.applyOptions({ width: entry.contentRect.width });
      }
    });
    observer.observe(container);

    const onThemeChange = () => applyTheme();
    const htmlObserver = new MutationObserver(onThemeChange);
    htmlObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
      htmlObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersPluginRef.current = null;
      priceLineRefs.current = [];
    };
  }, [height, applyTheme]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || candles.length === 0) return;

    try {
      const theme = getChartTheme();
      series.setData(toSeriesData(candles));

      for (const line of priceLineRefs.current) {
        series.removePriceLine(line);
      }
      priceLineRefs.current = [];

      for (const line of priceLines) {
        const priceLine = series.createPriceLine({
          price: line.price,
          title: line.title,
          color: line.color ?? theme.primary,
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
        });
        priceLineRefs.current.push(priceLine);
      }

      if (markers.length > 0) {
        markersPluginRef.current?.setMarkers(toSeriesMarkers(markers));
      } else {
        markersPluginRef.current?.setMarkers([]);
      }

      chart.timeScale().fitContent();
    } catch (err) {
      console.error('PriceChart update failed:', err);
    }
  }, [candles, priceLines, markers]);

  const handleExport = () => {
    const chart = chartRef.current;
    if (!chart) return;

    const canvas = chart.takeScreenshot(true, true);
    const link = document.createElement('a');
    link.download = `${exportFilename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (candles.length === 0) {
    return (
      <div
        className={`rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground ${className}`}
      >
        No candle data to chart.
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {(title || subtitle || showExport) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && (
              <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {showExport && (
            <Button variant="secondary" onClick={handleExport} className="shrink-0">
              <Download size={16} />
              Save chart
            </Button>
          )}
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-lg border border-border"
        style={{ height }}
        role="img"
        aria-label={title ?? 'Price candlestick chart'}
      />
    </div>
  );
}
