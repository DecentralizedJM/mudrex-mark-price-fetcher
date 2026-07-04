import { fetchCandlesChunked } from '../src/lib/api-chunk.ts';
import { formatPct, formatPrice } from '../src/lib/csv.ts';
import { normalizeSymbol } from '../src/lib/symbols.ts';
import { formatEpoch, parseLocalDateTime } from '../src/lib/time.ts';
import type { LtpCandle, MarkCandle, TimezoneId } from '../src/lib/types.ts';
import {
  fetchAssetBySymbol,
  isMudrexApiConfigured,
  validateAgainstMudrexAsset,
  type MudrexAsset,
} from './mudrex-assets.ts';

export type LiquidationSide = 'Long' | 'Short';

export interface LiquidationCheckInput {
  symbol: string;
  side: LiquidationSide;
  leverage: number | string;
  entryPrice: number | string;
  liquidationPrice: number | string;
  liquidationTime: string;
  timezone: TimezoneId;
}

export interface LiquidationMovementAnalysis {
  headline: string;
  paragraphs: string[];
  bullets: string[];
  /** Ready-to-send reply agents can paste into tickets / chat. */
  agentReply: string;
}

export interface LiquidationCheckResult {
  kind: 'hit' | 'miss' | 'error';
  message: string;
  extremeMark?: number;
  extremeTime?: number;
  markAtReport?: number;
  markOpen?: number;
  markClose?: number;
  analysis?: LiquidationMovementAnalysis;
  asset?: {
    symbol: string;
    name: string;
    minLeverage: string;
    maxLeverage: string;
    minPrice: string;
    maxPrice: string;
    priceStep: string;
    currentlyListed: boolean;
  };
}

function parsePositive(value: number | string, label: string): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return num;
}

function structuralPriceError(
  side: LiquidationSide,
  entryPrice: number,
  liquidationPrice: number,
): string | null {
  if (side === 'Long' && liquidationPrice >= entryPrice) {
    return 'For a Long position, liquidation price must be below entry price.';
  }
  if (side === 'Short' && liquidationPrice <= entryPrice) {
    return 'For a Short position, liquidation price must be above entry price.';
  }
  return null;
}

function pctFrom(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

function findNearestCandle<T extends number[]>(
  candles: T[],
  targetEpoch: number,
): T | null {
  if (candles.length === 0) return null;
  let best = candles[0];
  let bestDist = Math.abs(candles[0][0] - targetEpoch);
  for (const candle of candles) {
    const dist = Math.abs(candle[0] - targetEpoch);
    if (dist < bestDist) {
      best = candle;
      bestDist = dist;
    }
  }
  return best;
}

function buildAssetSummary(
  asset: MudrexAsset | null,
  normalizedSymbol: string,
): LiquidationCheckResult['asset'] {
  if (asset) {
    return {
      symbol: asset.symbol,
      name: asset.name,
      minLeverage: asset.min_leverage,
      maxLeverage: asset.max_leverage,
      minPrice: asset.min_price,
      maxPrice: asset.max_price,
      priceStep: asset.price_step,
      currentlyListed: true,
    };
  }
  return {
    symbol: normalizedSymbol.replace('/', ''),
    name: normalizedSymbol,
    minLeverage: '—',
    maxLeverage: '—',
    minPrice: '—',
    maxPrice: '—',
    priceStep: '—',
    currentlyListed: false,
  };
}

function buildMovementAnalysis(input: {
  kind: 'hit' | 'miss';
  symbol: string;
  side: LiquidationSide;
  leverage: number;
  entryPrice: number;
  liquidationPrice: number;
  reportedEpoch: number;
  timezone: TimezoneId;
  markCandles: MarkCandle[];
  ltpCandles: LtpCandle[];
  extremeMark: number;
  extremeTime: number;
  currentlyListed: boolean;
}): LiquidationMovementAnalysis {
  const {
    kind,
    symbol,
    side,
    leverage,
    entryPrice,
    liquidationPrice,
    reportedEpoch,
    timezone,
    markCandles,
    ltpCandles,
    extremeMark,
    extremeTime,
  } = input;

  const firstMark = markCandles[0];
  const lastMark = markCandles[markCandles.length - 1];
  const markOpen = firstMark[1];
  const markClose = lastMark[4];
  const markMovePct = pctFrom(markOpen, markClose);

  const reportMarkCandle = findNearestCandle(markCandles, reportedEpoch);
  const reportLtpCandle = findNearestCandle(ltpCandles, reportedEpoch);
  const markAtReport = reportMarkCandle ? reportMarkCandle[4] : extremeMark;
  const ltpAtReport = reportLtpCandle ? reportLtpCandle[4] : null;

  const entryToLiqPct = pctFrom(entryPrice, liquidationPrice);
  const extremeToLiqPct = pctFrom(liquidationPrice, extremeMark);
  const entryToExtremePct = pctFrom(entryPrice, extremeMark);

  const reportTimeLabel = formatEpoch(reportedEpoch, timezone);
  const extremeTimeLabel = formatEpoch(extremeTime, timezone);
  const windowStartLabel = formatEpoch(firstMark[0], timezone);
  const windowEndLabel = formatEpoch(lastMark[0], timezone);

  const adverseDir = side === 'Long' ? 'down' : 'up';
  const extremeLabel = side === 'Long' ? 'lowest' : 'highest';

  const headline =
    kind === 'hit'
      ? `${symbol} ${side} ${leverage}x: Mudrex mark price moved ${adverseDir} through the liquidation level.`
      : `${symbol} ${side} ${leverage}x: Mudrex mark price did not reach the reported liquidation level in this window.`;

  const paragraphs: string[] = [];

  paragraphs.push(
    `Position context: ${side} at entry ${formatPrice(entryPrice)} with liquidation price ${formatPrice(liquidationPrice)} (${formatPct(Math.abs(entryToLiqPct))} ${side === 'Long' ? 'below' : 'above'} entry) at ${leverage}x leverage. Reported liquidation time: ${reportTimeLabel}.`,
  );

  paragraphs.push(
    `Over the Mudrex mark-price window ${windowStartLabel} → ${windowEndLabel}, mark moved from ${formatPrice(markOpen)} to ${formatPrice(markClose)} (${markMovePct >= 0 ? '+' : ''}${markMovePct.toFixed(2)}%). The ${extremeLabel} mark in that window was ${formatPrice(extremeMark)} at ${extremeTimeLabel}.`,
  );

  if (kind === 'hit') {
    paragraphs.push(
      `Liquidations use Mark price, not last traded price (LTP). Mudrex mark ${extremeLabel} ${formatPrice(extremeMark)} ${side === 'Long' ? 'reached at or below' : 'reached at or above'} the liquidation price ${formatPrice(liquidationPrice)}, so a liquidation at the reported level is consistent with market data.`,
    );
  } else {
    const shortfallPct = Math.abs(extremeToLiqPct);
    paragraphs.push(
      `Mudrex mark did not ${side === 'Long' ? 'fall to' : 'rise to'} ${formatPrice(liquidationPrice)}. The ${extremeLabel} mark was ${formatPrice(extremeMark)} (${formatPct(shortfallPct)} away from the liquidation level). If the user was liquidated, the reported liquidation price or time may be incorrect.`,
    );
  }

  if (ltpAtReport !== null && reportMarkCandle) {
    const gap = markAtReport - ltpAtReport;
    const gapPct = ltpAtReport !== 0 ? (Math.abs(gap) / ltpAtReport) * 100 : 0;
    paragraphs.push(
      `Near the reported time, Mark close was ${formatPrice(markAtReport)} and LTP close was ${formatPrice(ltpAtReport)} (gap ${formatPrice(Math.abs(gap))}, ${formatPct(gapPct)}). Risk and liquidation checks follow Mark, so LTP alone can look different from the liquidation trigger.`,
    );
  }

  if (!input.currentlyListed) {
    paragraphs.push(
      `${symbol} is not currently listed on Mudrex futures; this analysis uses historical mark-kline data only.`,
    );
  }

  const bullets = [
    `Entry: ${formatPrice(entryPrice)} · Liquidation: ${formatPrice(liquidationPrice)} · Side: ${side} · Leverage: ${leverage}x`,
    `Mark window open → close: ${formatPrice(markOpen)} → ${formatPrice(markClose)} (${markMovePct >= 0 ? '+' : ''}${markMovePct.toFixed(2)}%)`,
    `${extremeLabel[0].toUpperCase()}${extremeLabel.slice(1)} mark: ${formatPrice(extremeMark)} at ${extremeTimeLabel}`,
    `Entry → extreme mark: ${entryToExtremePct >= 0 ? '+' : ''}${entryToExtremePct.toFixed(2)}%`,
    `Extreme mark vs liquidation: ${extremeToLiqPct >= 0 ? '+' : ''}${extremeToLiqPct.toFixed(2)}%`,
    `Mark candles in window: ${markCandles.length}`,
  ];

  if (ltpAtReport !== null) {
    bullets.push(`Near report time — Mark: ${formatPrice(markAtReport)}, LTP: ${formatPrice(ltpAtReport)}`);
  }

  const agentReply =
    kind === 'hit'
      ? [
          `We reviewed Mudrex mark price data for ${symbol} around ${reportTimeLabel}.`,
          `Your ${side.toLowerCase()} position (entry ${formatPrice(entryPrice)}, liquidation ${formatPrice(liquidationPrice)}, ${leverage}x) is liquidated based on Mark price, not last traded price.`,
          `In the surrounding window, Mudrex mark moved from ${formatPrice(markOpen)} to ${formatPrice(markClose)}. The ${extremeLabel} mark was ${formatPrice(extremeMark)} at ${extremeTimeLabel}, which ${side === 'Long' ? 'reached at or below' : 'reached at or above'} your liquidation price.`,
          `That confirms the mark price path was consistent with a liquidation at the reported level.`,
        ].join(' ')
      : [
          `We reviewed Mudrex mark price data for ${symbol} around ${reportTimeLabel}.`,
          `For your ${side.toLowerCase()} position (entry ${formatPrice(entryPrice)}, liquidation ${formatPrice(liquidationPrice)}, ${leverage}x), liquidations are based on Mark price.`,
          `In the surrounding window, the ${extremeLabel} Mudrex mark was ${formatPrice(extremeMark)} at ${extremeTimeLabel}, which did not reach the liquidation price of ${formatPrice(liquidationPrice)}.`,
          `Please share the exact liquidation price and timestamp from the app if you believe a liquidation still occurred, so we can re-check that specific level.`,
        ].join(' ');

  return { headline, paragraphs, bullets, agentReply };
}

export async function runLiquidationCheck(
  input: LiquidationCheckInput,
): Promise<LiquidationCheckResult> {
  let normalizedSymbol: string;
  try {
    normalizedSymbol = normalizeSymbol(input.symbol);
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'Invalid symbol format.',
    };
  }

  if (input.side !== 'Long' && input.side !== 'Short') {
    return { kind: 'error', message: 'Side must be Long or Short.' };
  }

  let leverage: number;
  let entryPrice: number;
  let liquidationPrice: number;
  try {
    leverage = parsePositive(input.leverage, 'Leverage');
    entryPrice = parsePositive(input.entryPrice, 'Entry price');
    liquidationPrice = parsePositive(input.liquidationPrice, 'Liquidation price');
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'Invalid numeric input.',
    };
  }

  const structural = structuralPriceError(input.side, entryPrice, liquidationPrice);
  if (structural) {
    return { kind: 'error', message: structural };
  }

  if (!input.liquidationTime) {
    return { kind: 'error', message: 'Reported liquidation time is required.' };
  }

  const liquidationDate = parseLocalDateTime(input.liquidationTime, input.timezone);
  if (Number.isNaN(liquidationDate.getTime())) {
    return { kind: 'error', message: 'Reported liquidation time is invalid.' };
  }
  if (liquidationDate.getTime() > Date.now() + 5 * 60 * 1000) {
    return { kind: 'error', message: 'Reported liquidation time cannot be in the future.' };
  }

  if (!isMudrexApiConfigured()) {
    return {
      kind: 'error',
      message:
        'Mudrex validation is not configured. Set MUDREX_API_KEY on the server to validate assets against Mudrex.',
    };
  }

  let asset: MudrexAsset | null;
  try {
    asset = await fetchAssetBySymbol(normalizedSymbol);
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'Failed to load asset from Mudrex.',
    };
  }

  if (asset) {
    const assetError = validateAgainstMudrexAsset({
      asset,
      leverage,
      entryPrice,
      liquidationPrice,
    });
    if (assetError) {
      return {
        kind: 'error',
        message: assetError,
        asset: buildAssetSummary(asset, normalizedSymbol),
      };
    }
  }

  const reportedEpoch = Math.floor(liquidationDate.getTime() / 1000);
  const windowStart = reportedEpoch - 15 * 60;
  const windowEnd = reportedEpoch + 15 * 60;

  let markCandles: number[][];
  let ltpCandles: number[][];
  try {
    [markCandles, ltpCandles] = await Promise.all([
      fetchCandlesChunked('mark-kline', normalizedSymbol, '1m', windowStart, windowEnd),
      fetchCandlesChunked('kline', normalizedSymbol, '1m', windowStart, windowEnd),
    ]);
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'Failed to fetch Mudrex price data.',
    };
  }

  const assetSummary = buildAssetSummary(asset, normalizedSymbol);

  if (markCandles.length === 0) {
    if (!asset) {
      return {
        kind: 'error',
        message: `${normalizedSymbol} was not found on Mudrex futures and has no mark price data in the reported window.`,
      };
    }
    return {
      kind: 'error',
      message: `No Mudrex mark price data for ${normalizedSymbol} in the 30-minute window around the reported time.`,
      asset: assetSummary,
    };
  }

  let extremeMark: number | null = null;
  let extremeTime: number | null = null;

  for (const candle of markCandles as MarkCandle[]) {
    const val = input.side === 'Long' ? candle[3] : candle[2];
    if (
      extremeMark === null ||
      (input.side === 'Long' ? val < extremeMark : val > extremeMark)
    ) {
      extremeMark = val;
      extremeTime = candle[0];
    }
  }

  if (extremeMark === null || extremeTime === null) {
    return { kind: 'error', message: 'No usable mark price candles returned by Mudrex.' };
  }

  const hit =
    input.side === 'Long' ? extremeMark <= liquidationPrice : extremeMark >= liquidationPrice;
  const kind = hit ? 'hit' : 'miss';
  const timeLabel = formatEpoch(extremeTime, input.timezone);
  const expectedDir = input.side === 'Long' ? 'drop to or below' : 'rise to or above';
  const actualDir = input.side === 'Long' ? 'Lowest' : 'Highest';

  const historicalNote = asset
    ? ''
    : ` ${normalizedSymbol} is not currently listed on Mudrex futures; verdict uses historical mark-kline data only.`;

  const analysis = buildMovementAnalysis({
    kind,
    symbol: normalizedSymbol,
    side: input.side,
    leverage,
    entryPrice,
    liquidationPrice,
    reportedEpoch,
    timezone: input.timezone,
    markCandles: markCandles as MarkCandle[],
    ltpCandles: ltpCandles as LtpCandle[],
    extremeMark,
    extremeTime,
    currentlyListed: Boolean(asset),
  });

  const markOpen = markCandles[0][1];
  const markClose = markCandles[markCandles.length - 1][4];
  const reportMark = findNearestCandle(markCandles as MarkCandle[], reportedEpoch);

  if (hit) {
    return {
      kind: 'hit',
      extremeMark,
      extremeTime,
      markAtReport: reportMark?.[4],
      markOpen,
      markClose,
      asset: assetSummary,
      analysis,
      message: `VALID: Mudrex mark price reached ${formatPrice(extremeMark)} at ${timeLabel}, crossing the liquidation threshold of ${formatPrice(liquidationPrice)}.${historicalNote}`,
    };
  }

  return {
    kind: 'miss',
    extremeMark,
    extremeTime,
    markAtReport: reportMark?.[4],
    markOpen,
    markClose,
    asset: assetSummary,
    analysis,
    message: `DID NOT REACH: The ${actualDir.toLowerCase()} Mudrex mark price in the window was ${formatPrice(extremeMark)} at ${timeLabel}. It did not ${expectedDir} the liquidation price of ${formatPrice(liquidationPrice)}.${historicalNote}`,
  };
}
