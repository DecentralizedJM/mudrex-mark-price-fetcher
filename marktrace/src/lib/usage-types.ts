export type UsageAction = 'page_load' | 'price_fetch' | 'csv_download' | 'rate_limited' | 'admin_login_failed';

export type UsageStatus = 'success' | 'validation_error' | 'api_error' | 'rate_limited' | 'failed';

export interface UsageEvent {
  id: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  referer?: string;
  action: UsageAction;
  status: UsageStatus;
  symbol?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  aggregation?: string;
  rowCount?: number;
  durationMs?: number;
  errorMessage?: string;
  csvFilename?: string;
  maxMarkLtpGapPct?: number | null;
}

export interface UsageEventInput {
  ip: string;
  userAgent: string;
  referer?: string;
  action: UsageAction;
  status: UsageStatus;
  symbol?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  aggregation?: string;
  rowCount?: number;
  durationMs?: number;
  errorMessage?: string;
  csvFilename?: string;
  maxMarkLtpGapPct?: number | null;
}

export interface IpSummary {
  ip: string;
  firstSeen: string;
  lastSeen: string;
  pageLoads: number;
  priceFetches: number;
  csvDownloads: number;
  failedFetches: number;
  rateLimited: number;
  lastAction: UsageAction;
  lastSymbol?: string;
  lastStartTime?: string;
  lastEndTime?: string;
  lastTimezone?: string;
  userAgent: string;
}

export interface UsageStats {
  totalEvents: number;
  uniqueIps: number;
  pageLoads: number;
  priceFetches: number;
  csvDownloads: number;
  failedFetches: number;
  rateLimited: number;
  eventsLast24h: number;
  successfulFetches: number;
}
