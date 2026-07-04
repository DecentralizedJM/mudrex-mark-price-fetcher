import type { LookupParams } from './types';

type TrackAction = 'page_load' | 'csv_download';

interface CsvTrackMeta {
  symbol: string;
  startTime: string;
  endTime: string;
  timezone: LookupParams['timezone'];
  aggregation: LookupParams['aggregation'];
  rowCount: number;
  csvFilename: string;
}

export function trackUsage(action: TrackAction, metadata?: Partial<CsvTrackMeta>): void {
  void fetch('/api/usage/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...metadata }),
  }).catch(() => {
    // Silent: tracking must not affect the dashboard
  });
}
