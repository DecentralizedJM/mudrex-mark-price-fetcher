import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { aggregationToSeconds } from './api-chunk';
import type { Aggregation, TimezoneId } from './types';

export function parseLocalDateTime(datetimeLocal: string, timezone: TimezoneId): Date {
  const parts = datetimeLocal.split(':');
  const iso = parts.length === 2 ? `${datetimeLocal}:00` : datetimeLocal;
  return fromZonedTime(iso, timezone);
}

export function localRangeToEpoch(
  startTime: string,
  endTime: string,
  timezone: TimezoneId
): { start: number; end: number } {
  const startDate = parseLocalDateTime(startTime, timezone);
  const endDate = parseLocalDateTime(endTime, timezone);

  return {
    start: Math.floor(startDate.getTime() / 1000),
    end: Math.floor(endDate.getTime() / 1000),
  };
}

export function formatEpoch(epoch: number, timezone: TimezoneId): string {
  const tzLabel = timezone === 'Asia/Kolkata' ? 'IST' : 'UTC';
  const formatted = formatInTimeZone(epoch * 1000, timezone, 'yyyy-MM-dd HH:mm:ss');
  return `${formatted} ${tzLabel}`;
}

export function formatEpochForInput(epoch: number, timezone: TimezoneId): string {
  return formatInTimeZone(epoch * 1000, timezone, "yyyy-MM-dd'T'HH:mm:ss");
}

export function defaultStartTime(timezone: TimezoneId): string {
  const d = new Date();
  d.setHours(d.getHours() - 1);
  return formatInTimeZone(d, timezone, "yyyy-MM-dd'T'HH:mm");
}

export function defaultEndTime(timezone: TimezoneId): string {
  const d = new Date();
  return formatInTimeZone(d, timezone, "yyyy-MM-dd'T'HH:mm");
}

export function estimateCandleCount(
  startEpoch: number,
  endEpoch: number,
  aggregation: Aggregation,
): number {
  const step = aggregationToSeconds(aggregation);
  if (endEpoch <= startEpoch) return 0;
  return Math.ceil((endEpoch - startEpoch) / step) + 1;
}

export function timezoneShortLabel(timezone: TimezoneId): string {
  return timezone === 'Asia/Kolkata' ? 'IST' : 'UTC';
}

/**
 * Convert a real UTC epoch into a "chart time" for lightweight-charts.
 * The library always formats timestamps as UTC, so we shift the value so its
 * UTC wall-clock matches the selected timezone (e.g. IST).
 */
export function epochToChartTime(epoch: number, timezone: TimezoneId): number {
  if (timezone === 'UTC') return epoch;

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date(epoch * 1000))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  // Some engines emit "24" for midnight with hour12: false.
  const hour = Number(parts.hour) % 24;

  return Math.floor(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      hour,
      Number(parts.minute),
      Number(parts.second),
    ) / 1000,
  );
}
