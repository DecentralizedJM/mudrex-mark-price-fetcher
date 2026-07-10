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
import { collectChartPrices, inferPriceFormat } from '../lib/chart-data';
import {
  buildCandlestickSeriesOptions,
  buildChartOptions,
  getChartTheme,
} from '../lib/chart-theme';
import { epochToChartTime, timezoneShortLabel } from '../lib/time';
import type { TimezoneId } from '../lib/types';
import { useResponsiveChartHeight } from '../hooks/useMediaQuery';
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
  timezone?: TimezoneId;
  priceLines?: PriceLineOverlay[];
  markers?: ChartMarkerInput[];
  legend?: { color: string; label: string }[];
  height?: number;
  showExport?: boolean;
  exportFilename?: string;
  className?: string;
}

function toSeriesData(candles: ChartCandle[], timezone: TimezoneId) {
  return candles.map((c) => ({
    time: epochToChartTime(c.time, timezone) as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

function toSeriesMarkers(markers: ChartMarkerInput[], timezone: TimezoneId): SeriesMarker<Time>[] {
  const theme = getChartTheme();
  return markers.map((m) => ({
    time: epochToChartTime(m.time, timezone) as UTCTimestamp,
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
  timezone = 'Asia/Kolkata',
  priceLines = EMPTY_PRICE_LINES,
  markers = EMPTY_MARKERS,
  legend,
  height = 320,
  showExport = true,
  exportFilename = 'price-chart',
  className = '',
}: PriceChartProps) {
  const chartHeight = useResponsiveChartHeight(height);
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
      height: chartHeight,
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
  }, [chartHeight, applyTheme]);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({ height: chartHeight });
    }
  }, [chartHeight]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || candles.length === 0) return;

    try {
      const theme = getChartTheme();
      const overlayPrices = priceLines.map((line) => line.price);
      const priceFormat = inferPriceFormat(collectChartPrices(candles, overlayPrices));

      series.applyOptions({
        priceFormat: {
          type: 'price',
          precision: priceFormat.precision,
          minMove: priceFormat.minMove,
        },
      });
      series.setData(toSeriesData(candles, timezone));

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
        markersPluginRef.current?.setMarkers(toSeriesMarkers(markers, timezone));
      } else {
        markersPluginRef.current?.setMarkers([]);
      }

      chart.timeScale().fitContent();
    } catch (err) {
      console.error('PriceChart update failed:', err);
    }
  }, [candles, priceLines, markers, timezone]);

  const handleExport = () => {
    const chart = chartRef.current;
    if (!chart) return;

    const canvas = chart.takeScreenshot(true, true);
    const link = document.createElement('a');
    link.download = `${exportFilename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const tzLabel = timezoneShortLabel(timezone);
  const resolvedSubtitle = subtitle
    ? `${subtitle} Times shown in ${tzLabel}.`
    : `Times shown in ${tzLabel}.`;

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
          <div className="min-w-0">
            {title && (
              <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            )}
            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{resolvedSubtitle}</p>
          </div>
          {showExport && (
            <Button variant="secondary" onClick={handleExport} className="w-full shrink-0 sm:w-auto">
              <Download size={16} />
              Save chart
            </Button>
          )}
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-lg border border-border touch-pan-x"
        style={{ height: chartHeight }}
        role="img"
        aria-label={title ?? 'Price candlestick chart'}
      />
      {legend && legend.length > 0 && (
        <div className="grid grid-cols-2 gap-2 pt-1 sm:flex sm:flex-wrap sm:gap-x-4 sm:gap-y-2">
          {legend.map((item) => (
            <div key={item.label} className="flex min-w-0 items-start gap-2 text-xs text-muted-foreground">
              <span
                className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span className="min-w-0 break-words leading-snug">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
