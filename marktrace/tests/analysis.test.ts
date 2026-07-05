import { describe, expect, it } from 'vitest';
import { analyzePriceMovement } from '../src/lib/analysis';
import type { FetchResult } from '../src/lib/types';

const sampleResult: FetchResult = {
  symbol: 'BTC/USDT',
  normalizedSymbol: 'BTC/USDT',
  fetchStart: 0,
  fetchEnd: 120,
  summary: {
    rowCount: 2,
    ltpMinLow: 99,
    ltpMaxHigh: 101,
    markMinLow: 99.5,
    markMaxHigh: 100.5,
    maxMarkLtpGap: 0.5,
    maxMarkLtpGapPct: 0.5,
    maxMarkLtpGapTime: 60,
  },
  rows: [
    {
      openTime: 0,
      ltp: { open: 100, high: 101, low: 99, close: 100, volume: 1 },
      mark: { open: 100, high: 100.5, low: 99.5, close: 100.2, volume: 0 },
    },
    {
      openTime: 60,
      ltp: { open: 100, high: 101, low: 99, close: 101, volume: 1 },
      mark: { open: 100.2, high: 100.8, low: 100, close: 100.5, volume: 0 },
    },
  ],
};

describe('analyzePriceMovement', () => {
  it('returns headline and severity for valid rows', () => {
    const analysis = analyzePriceMovement(sampleResult, 'UTC');
    expect(analysis.headline).toContain('BTC/USDT');
    expect(analysis.paragraphs.length).toBeGreaterThan(0);
    expect(['neutral', 'warning', 'critical']).toContain(analysis.severity);
  });
});
