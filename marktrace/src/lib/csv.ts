import { formatEpoch } from './time';
import type { FetchResult, MergedRow, TimezoneId } from './types';

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatNum(value: number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

function rowToCsv(row: MergedRow, timezone: TimezoneId, includeLabel: boolean): string[] {
  const markLtpGap =
    row.ltp && row.mark ? row.mark.close - row.ltp.close : null;

  const cols = [
    formatEpoch(row.openTime, timezone),
    ...(includeLabel ? [row.label ?? ''] : []),
    formatNum(row.ltp?.open),
    formatNum(row.ltp?.high),
    formatNum(row.ltp?.low),
    formatNum(row.ltp?.close),
    formatNum(row.ltp?.volume),
    formatNum(row.mark?.open),
    formatNum(row.mark?.high),
    formatNum(row.mark?.low),
    formatNum(row.mark?.close),
    markLtpGap === null ? '' : String(markLtpGap),
    row.isBuffer ? 'buffer' : 'core',
  ];

  return cols.map(escapeCsv);
}

export function buildCsv(
  result: FetchResult,
  timezone: TimezoneId,
  includeLabel: boolean,
): string {
  const headers = [
    'Time',
    ...(includeLabel ? ['Label'] : []),
    'LTP Open',
    'LTP High',
    'LTP Low',
    'LTP Close',
    'LTP Volume',
    'Mark Open',
    'Mark High',
    'Mark Low',
    'Mark Close',
    'Mark-LTP Close',
    'Range Type',
  ];

  const meta = [
    `# MarkTrace export`,
    `# Symbol: ${result.normalizedSymbol}`,
    `# Timezone: ${timezone}`,
    `# Rows: ${result.summary.rowCount}`,
  ];

  const lines = [
    ...meta,
    headers.join(','),
    ...result.rows.map((row) => rowToCsv(row, timezone, includeLabel).join(',')),
  ];

  return `\uFEFF${lines.join('\n')}`;
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function buildCsvFilename(
  symbol: string,
  date: string,
  startTime: string,
  endTime: string,
): string {
  const sanitizedSymbol = symbol.replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  const datePart = date.replace(/-/g, '');
  const startPart = startTime.replace(':', '');
  const endPart = endTime.replace(':', '');
  return `marktrace_${sanitizedSymbol}_${datePart}_${startPart}-${endPart}.csv`;
}

export function formatPrice(value: number | null | undefined, digits = 6): string {
  if (value === null || value === undefined) return '—';
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(4);
  return value.toFixed(digits);
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(2)}%`;
}

export function formatGap(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(6)}`;
}
