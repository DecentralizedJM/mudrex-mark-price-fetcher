import { formatGap, formatPct, formatPrice } from '../lib/csv';
import { formatEpoch } from '../lib/time';
import type { FetchSummary, TimezoneId } from '../lib/types';

interface SummaryCardsProps {
  summary: FetchSummary;
  timezone: TimezoneId;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-light bg-neutral-50/80 px-4 py-3 dark:border-border-dark dark:bg-neutral-900/50">
      <p className="text-xs font-medium uppercase tracking-wide text-secondary-light dark:text-secondary-dark">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-primary-light dark:text-primary-dark">
        {value}
      </p>
    </div>
  );
}

export function SummaryCards({ summary, timezone }: SummaryCardsProps) {
  const ltpRange =
    summary.ltpMinLow !== null && summary.ltpMaxHigh !== null
      ? `${formatPrice(summary.ltpMinLow)} → ${formatPrice(summary.ltpMaxHigh)}`
      : '—';

  const markRange =
    summary.markMinLow !== null && summary.markMaxHigh !== null
      ? `${formatPrice(summary.markMinLow)} → ${formatPrice(summary.markMaxHigh)}`
      : '—';

  const maxGap =
    summary.maxMarkLtpGap !== null
      ? `${formatGap(summary.maxMarkLtpGap)} (${formatPct(summary.maxMarkLtpGapPct)})`
      : '—';

  const maxGapTime =
    summary.maxMarkLtpGapTime !== null
      ? formatEpoch(summary.maxMarkLtpGapTime, timezone)
      : '';

  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Rows" value={String(summary.rowCount)} />
      <StatCard label="LTP range (low → high)" value={ltpRange} />
      <StatCard label="Mark range (low → high)" value={markRange} />
      <StatCard
        label="Max Mark−LTP close gap"
        value={maxGapTime ? `${maxGap} @ ${maxGapTime.split(' ').slice(1).join(' ')}` : maxGap}
      />
    </div>
  );
}
