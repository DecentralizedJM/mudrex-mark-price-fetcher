import { formatGap, formatPrice } from '../lib/csv';
import { formatEpoch } from '../lib/time';
import type { MergedRow, TimezoneId } from '../lib/types';
import { GAP_WARNING_PCT } from '../lib/types';

interface ResultsTableProps {
  rows: MergedRow[];
  timezone: TimezoneId;
  loading?: boolean;
}

function gapPct(row: MergedRow): number | null {
  if (!row.ltp || !row.mark || row.ltp.close === 0) return null;
  return (Math.abs(row.mark.close - row.ltp.close) / row.ltp.close) * 100;
}

export function ResultsTable({ rows, timezone, loading }: ResultsTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">No results yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter a symbol and time range, then click Fetch prices.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Example: ESPORTS/USDT · 18 Jun 2026 · 15:59 to 16:01 IST
        </p>
      </div>
    );
  }

  const headers = [
    'Time',
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

  const stickyHead =
    'sticky left-0 z-20 border-r border-border bg-muted shadow-[4px_0_8px_-4px_oklch(0_0_0/8%)] dark:shadow-[4px_0_8px_-4px_oklch(0_0_0/45%)]';
  const stickyBody =
    'sticky left-0 z-10 border-r border-border bg-card px-3 py-2.5 font-mono text-xs tabular-nums shadow-[4px_0_8px_-4px_oklch(0_0_0/8%)] group-hover:bg-muted/50 dark:shadow-[4px_0_8px_-4px_oklch(0_0_0/45%)]';

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted">
            {headers.map((h) => (
              <th
                key={h}
                className={`meta-label whitespace-nowrap px-3 py-3 ${
                  h === 'Time' ? stickyHead : ''
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
                className="group border-b border-border bg-card transition-colors hover:bg-muted/50"
              >
                <td className={`whitespace-nowrap ${stickyBody}`}>
                  <div className="flex items-center gap-2">
                    <span>{formatEpoch(row.openTime, timezone)}</span>
                  </div>
                </td>
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
                      ? 'font-semibold text-warning'
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
