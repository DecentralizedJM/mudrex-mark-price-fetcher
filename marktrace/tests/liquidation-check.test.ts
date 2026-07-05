import { describe, expect, it } from 'vitest';
import {
  computeLiquidationHit,
  markWindowBounds,
  structuralPriceError,
  validateCrossInWindow,
} from '../server-lib/liquidation-check.ts';

describe('structuralPriceError', () => {
  it('rejects long liquidation above entry', () => {
    expect(structuralPriceError('Long', 100, 105)).toMatch(/below entry/i);
  });

  it('rejects short liquidation below entry', () => {
    expect(structuralPriceError('Short', 100, 95)).toMatch(/above entry/i);
  });
});

describe('validateCrossInWindow', () => {
  it('rejects long when mark never reaches liquidation price', () => {
    const message = validateCrossInWindow({
      side: 'Long',
      liquidationPrice: 100,
      markLow: 90,
      markHigh: 98,
    });
    expect(message).toMatch(/never reached/i);
  });
});

describe('markWindowBounds', () => {
  it('finds min and max across OHLC', () => {
    const bounds = markWindowBounds([
      [1, 10, 12, 9, 11],
      [2, 11, 13, 8, 10],
    ]);
    expect(bounds.markLow).toBe(8);
    expect(bounds.markHigh).toBe(13);
  });
});

describe('computeLiquidationHit', () => {
  it('detects long liquidation hit when mark low crosses threshold', () => {
    expect(computeLiquidationHit('Long', 89, 90)).toBe(true);
    expect(computeLiquidationHit('Long', 91, 90)).toBe(false);
  });

  it('detects short liquidation hit when mark high crosses threshold', () => {
    expect(computeLiquidationHit('Short', 111, 110)).toBe(true);
    expect(computeLiquidationHit('Short', 109, 110)).toBe(false);
  });
});
