import { formatGap, formatPrice } from '../lib/csv';
import { formatEpoch } from '../lib/time';
import type { MergedRow, TimezoneId } from '../lib/types';
import { GAP_WARNING_PCT } from '../lib/types';

interface ResultsTableProps {
  rows: MergedRow[];
  timezone: TimezoneId;
  showLabel: boolean;
  loading?: boolean;
}

function gapPct(row: MergedRow): number | null {
  if (!row.ltp || !row.mark || row.ltp.close === 0) return null;
  return (Math.abs(row.mark.close - row.ltp.close) / row.ltp.close) * 100;
}

export function ResultsTable({ rows, timezone, showLabel, loading }: ResultsTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800"
          />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-light px-6 py-12 text-center dark:border-border-dark">
        <p className="text-sm font-medium text-primary-light dark:text-primary-dark">
          No results yet
        </p>
        <p className="mt-2 text-sm text-secondary-light dark:text-secondary-dark">
          Enter a symbol and time range, then click Fetch prices.
        </p>
        <p className="mt-4 text-xs text-secondary-light dark:text-secondary-dark">
          Example: ESPORTS/USDT · 18 Jun 2026 · 15:59–16:01 IST
        </p>
      </div>
    );
  }

  const headers = [
    'Time',
    ...(showLabel ? ['Label'] : []),
    'LTP Open',
    'LTP High',
    'LTP Low',
    'LTP Close',
    'LTP Vol',
    'Mark Open',
    'Mark High',
    'Mark Low',
    'Mark Close',
    'Mark−LTP',
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-border-light dark:border-border-dark">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border-light bg-neutral-50 dark:border-border-dark dark:bg-neutral-900/60">
            {headers.map((h) => (
              <th
                key={h}
                className={`whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-secondary-light dark:text-secondary-dark ${
                  h === 'Time' ? 'sticky left-0 z-10 bg-neutral-50 dark:bg-neutral-900/60' : ''
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const gap = row.ltp && row.mark ? row.mark.close - row.ltp.close : null;
            const gapPercent = gapPct(row);
            const highlightGap = gapPercent !== null && gapPercent > GAP_WARNING_PCT;

            return (
              <tr
                key={row.openTime}
                className={`border-b border-border-light transition-colors hover:bg-neutral-50 dark:border-border-dark dark:hover:bg-neutral-900/50 ${
                  row.isBuffer ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''
                }`}
              >
                <td className="sticky left-0 z-10 whitespace-nowrap bg-inherit px-3 py-2.5 font-mono text-xs tabular-nums">
                  <div className="flex items-center gap-2">
                    <span>{formatEpoch(row.openTime, timezone)}</span>
                    {row.isBuffer && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                        buffer
                      </span>
                    )}
                  </div>
                </td>
                {showLabel && (
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs tabular-nums">
                    {row.label ?? '—'}
                  </td>
                )}
                <td className="px-3 py-2.5 font-mono tabular-nums">{formatPrice(row.ltp?.open)}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{formatPrice(row.ltp?.high)}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{formatPrice(row.ltp?.low)}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{formatPrice(row.ltp?.close)}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{formatPrice(row.ltp?.volume)}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{formatPrice(row.mark?.open)}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{formatPrice(row.mark?.high)}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{formatPrice(row.mark?.low)}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{formatPrice(row.mark?.close)}</td>
                <td
                  className={`px-3 py-2.5 font-mono tabular-nums ${
                    highlightGap
                      ? 'font-semibold text-warning dark:text-amber-400'
                      : gap !== null && gap > 0
                        ? 'text-success'
                        : ''
                  }`}
                >
                  {formatGap(gap)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
