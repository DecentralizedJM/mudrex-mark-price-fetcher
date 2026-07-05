import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { aggregationToSeconds } from './api-chunk';
import type { Aggregation, TimezoneId } from './types';

export function parseLocalDateTime(datetimeLocal: string, timezone: TimezoneId): Date {
  const iso = `${datetimeLocal}:00`;
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
