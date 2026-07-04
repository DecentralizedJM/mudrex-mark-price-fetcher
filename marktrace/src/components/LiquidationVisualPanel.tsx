import { ArrowDown, ArrowUp } from 'lucide-react';
import { formatPrice } from '../lib/csv';
import { formatEpoch } from '../lib/time';
import type { TimezoneId } from '../lib/types';
import type { ChartMarkerInput, PriceLineOverlay } from './PriceChart';
import { PriceChart } from './PriceChart';
import type { ChartCandle } from '../lib/chart-data';
import { getChartTheme } from '../lib/chart-theme';

type LiquidationSide = 'Long' | 'Short';

interface LiquidationVisualPanelProps {
  side: LiquidationSide;
  symbol: string;
  leverage: string;
  entryPrice: number;
  liqPrice: number;
  liqTime: string;
  timezone: TimezoneId;
  kind: 'hit' | 'miss';
  extremeMark?: number;
  extremeTime?: number;
  markAtReport?: number;
  candles: ChartCandle[];
  priceLines: PriceLineOverlay[];
  markers: ChartMarkerInput[];
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'primary' | 'destructive' | 'success' | 'warning';
}) {
  const accentClass =
    accent === 'destructive'
      ? 'border-destructive/40 bg-destructive/10'
      : accent === 'success'
        ? 'border-success/40 bg-success/10'
        : accent === 'warning'
          ? 'border-warning/40 bg-warning/10'
          : accent === 'primary'
            ? 'border-primary-border bg-primary-subtle'
            : 'border-border bg-muted/50';

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${accentClass}`}>
      <p className="meta-label">{label}</p>
      <p className="mt-1 break-all font-mono text-sm font-semibold tabular-nums text-foreground sm:break-normal">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function crossingSummary(props: LiquidationVisualPanelProps): {
  text: string;
  accent: 'success' | 'destructive';
} {
  const { side, kind, extremeMark, extremeTime, liqPrice, timezone } = props;
  const extremeLabel =
    extremeMark !== undefined && extremeTime !== undefined
      ? `${formatPrice(extremeMark)} at ${formatEpoch(extremeTime, timezone)}`
      : 'unknown level';

  if (kind === 'hit') {
    if (side === 'Long') {
      return {
        accent: 'destructive',
        text: `Mark price fell to ${extremeLabel}, reaching or crossing the liquidation level of ${formatPrice(liqPrice)}. This matches how Mudrex triggers a Long liquidation.`,
      };
    }
    return {
      accent: 'destructive',
      text: `Mark price rose to ${extremeLabel}, reaching or crossing the liquidation level of ${formatPrice(liqPrice)}. This matches how Mudrex triggers a Short liquidation.`,
    };
  }

  if (side === 'Long') {
    return {
      accent: 'success',
      text: `The lowest mark in this window was ${extremeLabel}. It did not fall to the reported liquidation price of ${formatPrice(liqPrice)}.`,
    };
  }
  return {
    accent: 'success',
    text: `The highest mark in this window was ${extremeLabel}. It did not rise to the reported liquidation price of ${formatPrice(liqPrice)}.`,
  };
}

export function LiquidationVisualPanel(props: LiquidationVisualPanelProps) {
  const theme = getChartTheme();
  const { side, symbol, leverage, entryPrice, liqPrice, liqTime, kind, markAtReport } = props;
  const summary = crossingSummary(props);
  const reportedLabel = liqTime.replace('T', ' ');

  const ruleText =
    side === 'Long'
      ? 'For a Long, Mudrex liquidates when mark price falls to or below the liquidation price.'
      : 'For a Short, Mudrex liquidates when mark price rises to or above the liquidation price.';

  return (
    <div className="animate-in space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Visual liquidation check</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ruleText}</p>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
        <div className="min-w-0 space-y-1">
          <p className="meta-label">Position</p>
          <p className="break-words font-mono text-sm font-semibold text-foreground">
            {symbol} · {side} · {leverage}x
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
          <div className="flex-1 rounded-lg border border-primary-border bg-primary-subtle px-3 py-2.5 text-center sm:min-w-[7rem]">
            <p className="meta-label">Entry</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-primary">
              {formatPrice(entryPrice)}
            </p>
          </div>

          <div className="flex flex-row items-center justify-center gap-2 py-1 sm:flex-col sm:px-2 sm:py-0">
            {side === 'Long' ? (
              <ArrowDown className="h-5 w-5 shrink-0 text-destructive sm:h-6 sm:w-6" aria-hidden />
            ) : (
              <ArrowUp className="h-5 w-5 shrink-0 text-destructive sm:h-6 sm:w-6" aria-hidden />
            )}
            <span className="text-center text-[10px] uppercase leading-tight tracking-wide text-muted-foreground">
              mark must {side === 'Long' ? 'fall' : 'rise'}
            </span>
          </div>

          <div className="flex-1 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-center sm:min-w-[7rem]">
            <p className="meta-label">Liquidation</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-destructive">
              {formatPrice(liqPrice)}
            </p>
          </div>
        </div>
      </div>

      <div
        className={`rounded-lg border px-3 py-3 text-sm leading-relaxed sm:px-4 ${
          summary.accent === 'destructive' ? 'alert-destructive' : 'alert-success'
        }`}
      >
        {summary.text}
      </div>

      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Reported time" value={reportedLabel} accent="warning" />
        <StatCard
          label="Mark at reported time"
          value={markAtReport !== undefined ? formatPrice(markAtReport) : '-'}
          hint="Closest 1m mark candle"
        />
        <StatCard
          label={side === 'Long' ? 'Lowest mark in window' : 'Highest mark in window'}
          value={props.extremeMark !== undefined ? formatPrice(props.extremeMark) : '-'}
          accent={kind === 'hit' ? 'destructive' : 'success'}
        />
        <StatCard
          label="Liquidation threshold"
          value={formatPrice(liqPrice)}
          hint={kind === 'hit' ? 'Mark crossed this level' : 'Mark did not cross'}
          accent="destructive"
        />
      </div>

      <PriceChart
        candles={props.candles}
        title="Mark price chart (±15 min)"
        subtitle="Purple = entry · Red = liquidation · Yellow arrow = reported time · Teal dot = extreme mark"
        priceLines={props.priceLines}
        markers={props.markers}
        height={360}
        exportFilename={`liquidation-${symbol.replace('/', '-') || 'chart'}`}
        legend={[
          { color: theme.primary, label: `Entry ${formatPrice(entryPrice)}` },
          { color: theme.destructive, label: `Liquidation ${formatPrice(liqPrice)}` },
          { color: theme.warning, label: 'Reported time' },
          {
            color: theme.up,
            label: side === 'Long' ? 'Lowest mark (extreme)' : 'Highest mark (extreme)',
          },
        ]}
      />
    </div>
  );
}
