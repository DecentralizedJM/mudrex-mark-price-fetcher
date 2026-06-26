const KNOWN_QUOTES = ['USDT', 'USDC', 'USD', 'BTC', 'ETH', 'INR'] as const;

export function normalizeSymbol(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Symbol is required.');
  }

  const validRegex = /^[A-Z0-9]+$/;

  if (trimmed.includes('/')) {
    const [base, quote] = trimmed.split('/').map((part) => part.trim().toUpperCase());
    if (!base || !quote || !validRegex.test(base) || !validRegex.test(quote)) {
      throw new Error('Invalid symbol format. Use BASE/QUOTE, e.g. ESPORTS/USDT.');
    }
    return `${base}/${quote}`;
  }

  const upper = trimmed.toUpperCase();
  if (!validRegex.test(upper)) {
    throw new Error('Invalid symbol format. Symbols must only contain letters and numbers.');
  }

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

export function setListedSymbols(symbols: string[]): void {
  cachedSymbols = symbols.map((s) => normalizeSymbol(String(s)));
}

export function isSymbolListed(symbol: string, listed: string[]): boolean {
  const normalized = symbol.toUpperCase();
  return listed.some((s) => s.toUpperCase() === normalized);
}

export function suggestSimilarSymbols(symbol: string, listed: string[], limit = 3): string[] {
  const normalized = symbol.toUpperCase();
  const base = normalized.split('/')[0] ?? normalized;

  const scored = listed
    .map((candidate) => {
      const upper = candidate.toUpperCase();
      const candidateBase = upper.split('/')[0] ?? upper;
      let score = 0;
      if (upper === normalized) score += 100;
      if (upper.startsWith(base) || base.startsWith(candidateBase)) score += 50;
      if (upper.includes(base) || candidateBase.includes(base)) score += 25;
      return { candidate, score };
    })
    .filter((item) => item.score > 0 && item.candidate.toUpperCase() !== normalized)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((item) => item.candidate);
}

export function formatUnlistedSymbolError(symbol: string, suggestions: string[]): string {
  if (suggestions.length > 0) {
    return `${symbol} is not a listed futures symbol. Did you mean: ${suggestions.join(', ')}?`;
  }
  return `${symbol} is not a listed futures symbol. Pick a symbol from the suggestions list.`;
}

export function filterSymbols(symbols: string[], query: string, limit = 8): string[] {
  const q = query.trim().toUpperCase();
  if (!q) return symbols.slice(0, limit);

  return symbols
    .filter((symbol) => symbol.includes(q) || symbol.replace('/', '').includes(q.replace('/', '')))
    .slice(0, limit);
}

export async function validateListedSymbol(symbol: string): Promise<string | null> {
  let normalized: string;
  try {
    normalized = normalizeSymbol(symbol);
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid symbol format.';
  }

  const listed = await loadSymbolSuggestions();
  if (!isSymbolListed(normalized, listed)) {
    const suggestions = suggestSimilarSymbols(normalized, listed);
    return formatUnlistedSymbolError(normalized, suggestions);
  }

  return null;
}
