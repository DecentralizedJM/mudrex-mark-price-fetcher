import { formatPrice, formatPct } from './csv';
import { formatEpoch } from './time';
import type { FetchResult, MergedRow, PriceAnalysis, TimezoneId } from './types';
import { GAP_WARNING_PCT } from './types';

function findExtremeRow(
  rows: MergedRow[],
  pick: (row: MergedRow) => number | undefined,
  mode: 'min' | 'max',
): MergedRow | null {
  let best: MergedRow | null = null;
  let bestVal: number | null = null;

  for (const row of rows) {
    const val = pick(row);
    if (val === undefined) continue;
    if (bestVal === null || (mode === 'min' ? val < bestVal : val > bestVal)) {
      bestVal = val;
      best = row;
    }
  }

  return best;
}

function pctChange(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

function directionLabel(pct: number): string {
  if (Math.abs(pct) < 0.05) return 'flat';
  return pct > 0 ? 'up' : 'down';
}

export function analyzePriceMovement(
  result: FetchResult,
  timezone: TimezoneId,
): PriceAnalysis {
  const rows = result.rows;
  const { summary, normalizedSymbol } = result;

  const firstLtp = rows.find((r) => r.ltp)?.ltp?.close;
  const lastLtp = [...rows].reverse().find((r) => r.ltp)?.ltp?.close;
  const firstMark = rows.find((r) => r.mark)?.mark?.close;
  const lastMark = [...rows].reverse().find((r) => r.mark)?.mark?.close;

  const ltpMovePct =
    firstLtp !== undefined && lastLtp !== undefined ? pctChange(firstLtp, lastLtp) : null;
  const markMovePct =
    firstMark !== undefined && lastMark !== undefined ? pctChange(firstMark, lastMark) : null;

  const ltpLowRow = findExtremeRow(rows, (r) => r.ltp?.low, 'min');
  const ltpHighRow = findExtremeRow(rows, (r) => r.ltp?.high, 'max');
  const markLowRow = findExtremeRow(rows, (r) => r.mark?.low, 'min');
  const markHighRow = findExtremeRow(rows, (r) => r.mark?.high, 'max');

  const largeGaps = rows.filter((r) => {
    if (!r.ltp || !r.mark || r.ltp.close === 0) return false;
    const gapPct = (Math.abs(r.mark.close - r.ltp.close) / r.ltp.close) * 100;
    return gapPct > GAP_WARNING_PCT;
  });

  const maxGapPct = summary.maxMarkLtpGapPct ?? 0;
  let severity: PriceAnalysis['severity'] = 'neutral';
  if (maxGapPct > 3 || (ltpMovePct !== null && Math.abs(ltpMovePct) > 5)) {
    severity = 'critical';
  } else if (maxGapPct > GAP_WARNING_PCT || largeGaps.length > 0) {
    severity = 'warning';
  }

  const headlineParts: string[] = [];
  if (ltpMovePct !== null) {
    headlineParts.push(`LTP moved ${directionLabel(ltpMovePct)} ${Math.abs(ltpMovePct).toFixed(2)}%`);
  }
  if (markMovePct !== null) {
    headlineParts.push(`Mark moved ${directionLabel(markMovePct)} ${Math.abs(markMovePct).toFixed(2)}%`);
  }
  const headline =
    headlineParts.length > 0
      ? `${normalizedSymbol}: ${headlineParts.join('; ')} over the selected window.`
      : `${normalizedSymbol}: Price data loaded for the selected window.`;

  const paragraphs: string[] = [];

  if (firstLtp !== undefined && lastLtp !== undefined) {
    paragraphs.push(
      `Last traded price (LTP) went from ${formatPrice(firstLtp)} to ${formatPrice(lastLtp)} (${ltpMovePct !== null && ltpMovePct >= 0 ? '+' : ''}${ltpMovePct?.toFixed(2) ?? '0'}%). LTP ranged between ${formatPrice(summary.ltpMinLow)} and ${formatPrice(summary.ltpMaxHigh)}.`,
    );
  }

  if (firstMark !== undefined && lastMark !== undefined) {
    paragraphs.push(
      `Mark price moved from ${formatPrice(firstMark)} to ${formatPrice(lastMark)} (${markMovePct !== null && markMovePct >= 0 ? '+' : ''}${markMovePct?.toFixed(2) ?? '0'}%). Mark ranged between ${formatPrice(summary.markMinLow)} and ${formatPrice(summary.markMaxHigh)}.`,
    );
  }

  if (summary.maxMarkLtpGap !== null && summary.maxMarkLtpGapTime !== null) {
    const gapDirection = summary.maxMarkLtpGap >= 0 ? 'above' : 'below';
    paragraphs.push(
      `The largest Mark−LTP close gap was ${formatPrice(Math.abs(summary.maxMarkLtpGap))} (${formatPct(summary.maxMarkLtpGapPct)}), with Mark ${gapDirection} LTP at ${formatEpoch(summary.maxMarkLtpGapTime, timezone)}. Liquidations and risk checks use Mark price, not LTP.`,
    );
  }

  if (largeGaps.length > 0) {
    paragraphs.push(
      `${largeGaps.length} candle(s) had Mark−LTP close gaps above ${GAP_WARNING_PCT}%. This can happen during volatile moves or thin liquidity and may explain user reports of unexpected liquidations if Mark diverged from LTP.`,
    );
  } else if (summary.maxMarkLtpGapPct !== null && summary.maxMarkLtpGapPct <= GAP_WARNING_PCT) {
    paragraphs.push(
      `Mark and LTP stayed closely aligned (max gap ${formatPct(summary.maxMarkLtpGapPct)}). If a user claims an incorrect liquidation, compare their reported time against Mark lows/highs rather than LTP wicks.`,
    );
  }

  const bullets: string[] = [];

  if (ltpLowRow?.ltp) {
    bullets.push(
      `Lowest LTP: ${formatPrice(ltpLowRow.ltp.low)} at ${formatEpoch(ltpLowRow.openTime, timezone)}`,
    );
  }
  if (ltpHighRow?.ltp) {
    bullets.push(
      `Highest LTP: ${formatPrice(ltpHighRow.ltp.high)} at ${formatEpoch(ltpHighRow.openTime, timezone)}`,
    );
  }
  if (markLowRow?.mark) {
    bullets.push(
      `Lowest Mark: ${formatPrice(markLowRow.mark.low)} at ${formatEpoch(markLowRow.openTime, timezone)}`,
    );
  }
  if (markHighRow?.mark) {
    bullets.push(
      `Highest Mark: ${formatPrice(markHighRow.mark.high)} at ${formatEpoch(markHighRow.openTime, timezone)}`,
    );
  }

  if (ltpLowRow && markLowRow && ltpLowRow.openTime === markLowRow.openTime) {
    bullets.push(
      `At the Mark low candle, LTP low was ${formatPrice(ltpLowRow.ltp?.low)} vs Mark low ${formatPrice(markLowRow.mark?.low)}.`,
    );
  }

  if (severity === 'critical') {
    bullets.push(
      'Support note: Significant volatility or Mark/LTP divergence detected — cite Mark price timestamps when explaining liquidation triggers.',
    );
  }

  return {
    headline,
    paragraphs,
    bullets,
    severity,
  };
}
