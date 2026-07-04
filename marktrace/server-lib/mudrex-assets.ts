const FUTURES_BASE = 'https://trade.mudrex.com/fapi/v1/futures';

export interface MudrexAsset {
  id: string;
  name: string;
  symbol: string;
  min_leverage: string;
  max_leverage: string;
  leverage_step: string;
  min_price: string;
  max_price: string;
  price_step: string;
  price?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  errors?: { code: number | string; text: string }[];
}

export function toCompactSymbol(normalizedSymbol: string): string {
  return normalizedSymbol.replace('/', '').toUpperCase();
}

export function isMudrexApiConfigured(): boolean {
  return Boolean(process.env.MUDREX_API_KEY?.trim());
}

function parseNum(value: string | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** True if value is within one step of a valid multiple of `step` (float-safe). */
export function isMultipleOfStep(value: number, step: number): boolean {
  if (step <= 0) return true;
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < 1e-8;
}

export async function fetchAssetBySymbol(normalizedSymbol: string): Promise<MudrexAsset | null> {
  const apiKey = process.env.MUDREX_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('MUDREX_API_KEY is not configured on the server.');
  }

  const compact = toCompactSymbol(normalizedSymbol);
  const response = await fetch(`${FUTURES_BASE}/${encodeURIComponent(compact)}?is_symbol`, {
    headers: { 'X-Authentication': apiKey },
  });

  const json = (await response.json()) as ApiEnvelope<MudrexAsset>;

  if (response.status === 404 || (!json.success && json.errors?.[0]?.code === 404)) {
    return null;
  }

  if (!json.success || !json.data) {
    const text = json.errors?.[0]?.text ?? 'Failed to load asset from Mudrex.';
    throw new Error(text);
  }

  return json.data;
}

export function validateAgainstMudrexAsset(input: {
  asset: MudrexAsset;
  leverage: number;
  entryPrice: number;
  liquidationPrice: number;
}): string | null {
  const { asset, leverage, entryPrice, liquidationPrice } = input;

  const minLev = parseNum(asset.min_leverage);
  const maxLev = parseNum(asset.max_leverage);
  const levStep = parseNum(asset.leverage_step) ?? 0.01;
  const minPrice = parseNum(asset.min_price);
  const maxPrice = parseNum(asset.max_price);
  const priceStep = parseNum(asset.price_step) ?? 0;

  if (minLev !== null && leverage < minLev) {
    return `Leverage must be at least ${minLev}x for ${asset.symbol} (Mudrex min).`;
  }
  if (maxLev !== null && leverage > maxLev) {
    return `Leverage must be at most ${maxLev}x for ${asset.symbol} (Mudrex max).`;
  }
  if (!isMultipleOfStep(leverage, levStep)) {
    return `Leverage must be a multiple of ${levStep} for ${asset.symbol} (Mudrex leverage_step).`;
  }

  for (const [label, price] of [
    ['Entry price', entryPrice],
    ['Liquidation price', liquidationPrice],
  ] as const) {
    if (minPrice !== null && price < minPrice) {
      return `${label} must be at least ${minPrice} for ${asset.symbol} (Mudrex min_price).`;
    }
    if (maxPrice !== null && price > maxPrice) {
      return `${label} must be at most ${maxPrice} for ${asset.symbol} (Mudrex max_price).`;
    }
    if (priceStep > 0 && !isMultipleOfStep(price, priceStep)) {
      return `${label} must be a multiple of ${priceStep} for ${asset.symbol} (Mudrex price_step).`;
    }
  }

  return null;
}
