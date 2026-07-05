import { describe, expect, it } from 'vitest';
import {
  formatUnlistedSymbolError,
  isSymbolListed,
  normalizeSymbol,
  suggestSimilarSymbols,
} from '../src/lib/symbols';

describe('normalizeSymbol', () => {
  it('accepts slash format', () => {
    expect(normalizeSymbol('btc/usdt')).toBe('BTC/USDT');
  });

  it('parses compact USDT symbols', () => {
    expect(normalizeSymbol('esportsusdt')).toBe('ESPORTS/USDT');
  });

  it('rejects empty input', () => {
    expect(() => normalizeSymbol('   ')).toThrow('Symbol is required.');
  });

  it('rejects invalid characters', () => {
    expect(() => normalizeSymbol('BTC-USDT')).toThrow('Invalid symbol format');
  });
});

describe('listed symbol helpers', () => {
  const listed = ['BTC/USDT', 'ESPORTS/USDT', 'EVAA/USDT'];

  it('detects listed symbols case-insensitively', () => {
    expect(isSymbolListed('btc/usdt', listed)).toBe(true);
  });

  it('suggests similar symbols', () => {
    expect(suggestSimilarSymbols('ESPORT/USDT', listed)).toContain('ESPORTS/USDT');
  });

  it('formats unlisted symbol errors with suggestions', () => {
    const message = formatUnlistedSymbolError('FOO/USDT', ['BTC/USDT']);
    expect(message).toContain('FOO/USDT');
    expect(message).toContain('BTC/USDT');
  });
});
