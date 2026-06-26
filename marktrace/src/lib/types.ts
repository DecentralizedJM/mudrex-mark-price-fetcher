export type Aggregation = '1m' | '3t' | '5t' | '15t' | '30t' | '1h';

export type TimezoneId = 'Asia/Kolkata' | 'UTC';

export interface LookupParams {
  symbol: string;
  startTime: string; // YYYY-MM-DDTHH:mm
  endTime: string;   // YYYY-MM-DDTHH:mm
  timezone: TimezoneId;
  aggregation: Aggregation;
}

export type LtpCandle = [number, number, number, number, number, number];
export type MarkCandle = [number, number, number, number, number];

export interface MergedRow {
  openTime: number;
  ltp?: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
  mark?: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
}

export interface FetchSummary {
  rowCount: number;
  ltpMinLow: number | null;
  ltpMaxHigh: number | null;
  markMinLow: number | null;
  markMaxHigh: number | null;
  maxMarkLtpGap: number | null;
  maxMarkLtpGapPct: number | null;
  maxMarkLtpGapTime: number | null;
}

export interface FetchResult {
  symbol: string;
  normalizedSymbol: string;
  rows: MergedRow[];
  summary: FetchSummary;
  fetchStart: number;
  fetchEnd: number;
}

export interface ApiError {
  message: string;
}

export interface PriceAnalysis {
  headline: string;
  paragraphs: string[];
  bullets: string[];
  severity: 'neutral' | 'warning' | 'critical';
}

export const AGGREGATION_OPTIONS: { value: Aggregation; label: string }[] = [
  { value: '1m', label: '1 minute' },
  { value: '3t', label: '3 minutes' },
  { value: '5t', label: '5 minutes' },
  { value: '15t', label: '15 minutes' },
  { value: '30t', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
];

export const TIMEZONE_OPTIONS: { value: TimezoneId; label: string }[] = [
  { value: 'Asia/Kolkata', label: 'IST (Asia/Kolkata)' },
  { value: 'UTC', label: 'UTC' },
];

export const MAX_CANDLES = 1440;
export const GAP_WARNING_PCT = 1;
export const MAX_RANGE_SECONDS = 86400; // 24 hours
