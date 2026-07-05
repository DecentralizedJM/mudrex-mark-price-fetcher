import { describe, expect, it } from 'vitest';
import { estimateCandleCount } from '../src/lib/time';
import { formatEpoch, localRangeToEpoch } from '../src/lib/time';

describe('localRangeToEpoch', () => {
  it('converts IST datetime-local values to epoch seconds', () => {
    const { start, end } = localRangeToEpoch(
      '2026-06-18T15:59',
      '2026-06-18T16:01',
      'Asia/Kolkata',
    );
    expect(end).toBeGreaterThan(start);
    expect(end - start).toBe(120);
  });

  it('formats epoch with timezone label', () => {
    const { start } = localRangeToEpoch('2026-06-18T15:59', '2026-06-18T16:01', 'UTC');
    expect(formatEpoch(start, 'UTC')).toContain('UTC');
  });
});

describe('estimateCandleCount', () => {
  it('counts one-minute candles across a range', () => {
    expect(estimateCandleCount(0, 300, '1m')).toBe(6);
  });
});
