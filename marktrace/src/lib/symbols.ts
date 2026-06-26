const KNOWN_QUOTES = ['USDT', 'USDC', 'USD', 'BTC', 'ETH', 'INR'] as const;

export function normalizeSymbol(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Symbol is required.');
  }

  if (trimmed.includes('/')) {
    const [base, quote] = trimmed.split('/').map((part) => part.trim().toUpperCase());
    if (!base || !quote) {
      throw new Error('Use BASE/QUOTE format, e.g. ESPORTS/USDT.');
    }
    return `${base}/${quote}`;
  }

  const upper = trimmed.toUpperCase();
  for (const quote of KNOWN_QUOTES) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      const base = upper.slice(0, -quote.length);
      return `${base}/${quote}`;
    }
  }

  throw new Error('Could not parse symbol. Use BASE/QUOTE format, e.g. ESPORTS/USDT.');
}

const FALLBACK_SYMBOLS = [
  'BTC/USDT',
  'ETH/USDT',
  'ESPORTS/USDT',
  'EVAA/USDT',
  'SOL/USDT',
  'DOGE/USDT',
  'XRP/USDT',
  'BNB/USDT',
];

let cachedSymbols: string[] | null = null;

export async function loadSymbolSuggestions(): Promise<string[]> {
  if (cachedSymbols) return cachedSymbols;

  try {
    const response = await fetch('/all-futures-symbols.json');
    if (response.ok) {
      const data = (await response.json()) as string[] | { symbols?: string[] };
      if (Array.isArray(data)) {
        cachedSymbols = data.map((s) => normalizeSymbol(String(s)));
        return cachedSymbols;
      }
      if (data.symbols && Array.isArray(data.symbols)) {
        cachedSymbols = data.symbols.map((s) => normalizeSymbol(String(s)));
        return cachedSymbols;
      }
    }
  } catch {
    // fall through to defaults
  }

  cachedSymbols = FALLBACK_SYMBOLS;
  return cachedSymbols;
}

export function filterSymbols(symbols: string[], query: string, limit = 8): string[] {
  const q = query.trim().toUpperCase();
  if (!q) return symbols.slice(0, limit);

  return symbols
    .filter((symbol) => symbol.includes(q) || symbol.replace('/', '').includes(q.replace('/', '')))
    .slice(0, limit);
}
