import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { aggregationToSeconds } from './api-chunk';
import type { Aggregation, TimezoneId } from './types';

export function parseLocalDateTime(date: string, time: string, timezone: TimezoneId): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const localIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  return fromZonedTime(localIso, timezone);
}

export function localRangeToEpoch(
  date: string,
  startTime: string,
  endTime: string,
  timezone: TimezoneId,
  bufferMinutes: number,
): {
  coreStart: number;
  coreEnd: number;
  fetchStart: number;
  fetchEnd: number;
} {
  const coreStartDate = parseLocalDateTime(date, startTime, timezone);
  const coreEndDate = parseLocalDateTime(date, endTime, timezone);

  const coreStart = Math.floor(coreStartDate.getTime() / 1000);
  const coreEnd = Math.floor(coreEndDate.getTime() / 1000);
  const bufferSeconds = bufferMinutes * 60;

  return {
    coreStart,
    coreEnd,
    fetchStart: coreStart - bufferSeconds,
    fetchEnd: coreEnd + bufferSeconds,
  };
}

export function formatEpoch(epoch: number, timezone: TimezoneId): string {
  const tzLabel = timezone === 'Asia/Kolkata' ? 'IST' : 'UTC';
  const formatted = formatInTimeZone(epoch * 1000, timezone, 'yyyy-MM-dd HH:mm:ss');
  return `${formatted} ${tzLabel}`;
}

export function formatTimeOnly(epoch: number, timezone: TimezoneId): string {
  return formatInTimeZone(epoch * 1000, timezone, 'HH:mm');
}

export function todayInTimezone(timezone: TimezoneId): string {
  return formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
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
