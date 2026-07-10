import { fetchCandlesChunked } from '../src/lib/api-chunk.ts';
import { formatPct, formatPrice } from '../src/lib/csv.ts';
import { normalizeSymbol } from '../src/lib/symbols.ts';
import { formatEpoch, parseLocalDateTime } from '../src/lib/time.ts';
import type { LtpCandle, MarkCandle, TimezoneId } from '../src/lib/types.ts';
import {
  fetchPeerExchangesMark,
  PEER_EXCHANGE_LABELS,
  type PeerExchangeId,
  type PeerMarkResult,
} from './peer-exchanges.ts';
import {
  fetchAssetBySymbol,
  isMudrexApiConfigured,
  validateAgainstMudrexAsset,
  type MudrexAsset,
} from './mudrex-assets.ts';

export type { PeerExchangeId } from './peer-exchanges.ts';

export type LiquidationSide = 'Long' | 'Short';

export interface LiquidationCheckInput {
  symbol: string;
  side: LiquidationSide;
  leverage: number | string;
  entryPrice: number | string;
  liquidationPrice: number | string;
  liquidationTime: string;
  timezone: TimezoneId;
  /** Optional peer exchanges to compare mark price against (Bybit, Binance, Delta). */
  peerExchanges?: PeerExchangeId[];
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
  /** Mark klines for the ±15m liquidation window (1m candles). */
  markCandles?: MarkCandle[];
  analysis?: LiquidationMovementAnalysis;
  peerResults?: PeerMarkResult[];
  peerAnalysis?: LiquidationMovementAnalysis;
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

function markWindowBounds(markCandles: MarkCandle[]): { markLow: number; markHigh: number } {
  let markLow = Infinity;
  let markHigh = -Infinity;
  for (const candle of markCandles) {
    // [openTime, open, high, low, close]
    markLow = Math.min(markLow, candle[1], candle[2], candle[3], candle[4]);
    markHigh = Math.max(markHigh, candle[1], candle[2], candle[3], candle[4]);
  }
  return { markLow, markHigh };
}

/**
 * Entry / liq must sit near Mudrex mark prices in the window.
 * Rejects nonsense like entry=2 / liq=1 when mark is ~0.025.
 */
function validatePricesAgainstMarkWindow(input: {
  entryPrice: number;
  liquidationPrice: number;
  markLow: number;
  markHigh: number;
  symbol: string;
}): string | null {
  const { entryPrice, liquidationPrice, markLow, markHigh, symbol } = input;
  // Allow wide room for volatility, but block orders-of-magnitude mismatches.
  const floor = markLow * 0.2;
  const ceiling = markHigh * 5;

  if (entryPrice < floor || entryPrice > ceiling) {
    return `Entry price ${formatPrice(entryPrice)} is far from Mudrex mark prices in this window (${formatPrice(markLow)} to ${formatPrice(markHigh)} for ${symbol}). Use the real entry from the position.`;
  }
  if (liquidationPrice < floor || liquidationPrice > ceiling) {
    return `Liquidation price ${formatPrice(liquidationPrice)} is far from Mudrex mark prices in this window (${formatPrice(markLow)} to ${formatPrice(markHigh)} for ${symbol}). Use the real liquidation price from the position.`;
  }
  return null;
}

/**
 * A liquidation in this window requires mark to cross the liq level,
 * not merely sit on the wrong side of an absurd threshold.
 */
function validateCrossInWindow(input: {
  side: LiquidationSide;
  liquidationPrice: number;
  markLow: number;
  markHigh: number;
}): string | null {
  const { side, liquidationPrice, markLow, markHigh } = input;
  if (side === 'Long') {
    // Mark must have reached liq from above (high at or above liq). Always-below is invalid input.
    if (markHigh < liquidationPrice) {
      return `Mudrex mark never reached the liquidation price ${formatPrice(liquidationPrice)} in this window (mark high ${formatPrice(markHigh)}). Mark stayed below that level, so these prices do not describe a liquidation event here.`;
    }
  } else if (markLow > liquidationPrice) {
    // Mark must have reached liq from below (low at or below liq). Always-above is invalid input.
    return `Mudrex mark never reached the liquidation price ${formatPrice(liquidationPrice)} in this window (mark low ${formatPrice(markLow)}). Mark stayed above that level, so these prices do not describe a liquidation event here.`;
  }
  return null;
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
    minLeverage: '-',
    maxLeverage: '-',
    minPrice: '-',
    maxPrice: '-',
    priceStep: '-',
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
    bullets.push(`Near report time: Mark ${formatPrice(markAtReport)}, LTP ${formatPrice(ltpAtReport)}`);
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

function buildPeerExchangeAnalysis(input: {
  kind: 'hit' | 'miss';
  symbol: string;
  side: LiquidationSide;
  liquidationPrice: number;
  mudrexExtremeMark: number;
  mudrexMarkMovePct: number;
  peerResults: PeerMarkResult[];
}): LiquidationMovementAnalysis {
  const { kind, symbol, side, liquidationPrice, mudrexExtremeMark, mudrexMarkMovePct, peerResults } =
    input;

  const okPeers = peerResults.filter((r): r is Extract<PeerMarkResult, { status: 'ok' }> => r.status === 'ok');
  const unavailable = peerResults.filter((r) => r.status !== 'ok');

  const extremeLabel = side === 'Long' ? 'lowest' : 'highest';
  const mudrexAbsMove = Math.abs(mudrexMarkMovePct);

  const headline =
    okPeers.length === 0
      ? `Peer exchange mark data was unavailable for ${symbol} in this window.`
      : `Peer exchange mark comparison for ${symbol} (±15 min around reported liquidation).`;

  const paragraphs: string[] = [];

  if (okPeers.length === 0) {
    paragraphs.push(
      `Requested peer exchanges did not return usable mark-price candles for ${symbol} in the same window. This can mean the symbol is not listed on those venues or the APIs were temporarily unavailable.`,
    );
    for (const u of unavailable) {
      paragraphs.push(
        `${PEER_EXCHANGE_LABELS[u.exchange]}: ${u.message}`,
      );
    }
  } else {
    const peerMoveSummary = okPeers
      .map(
        (p) =>
          `${PEER_EXCHANGE_LABELS[p.exchange]} ${p.markMovePct >= 0 ? '+' : ''}${p.markMovePct.toFixed(2)}%`,
      )
      .join('; ');

    paragraphs.push(
      `Mudrex mark moved ${mudrexMarkMovePct >= 0 ? '+' : ''}${mudrexMarkMovePct.toFixed(2)}% over the window (absolute ${mudrexAbsMove.toFixed(2)}%). Peer mark moves: ${peerMoveSummary}.`,
    );

    const peersCrossed = okPeers.filter((p) => p.crossedLiq);
    const peersNotCrossed = okPeers.filter((p) => !p.crossedLiq);

    if (kind === 'hit' && peersCrossed.length === 0 && peersNotCrossed.length > 0) {
      paragraphs.push(
        `Mudrex mark ${extremeLabel} ${formatPrice(mudrexExtremeMark)} reached the liquidation level ${formatPrice(liquidationPrice)}, but none of the available peer marks crossed that level in the same window. This suggests Mudrex-specific mark volatility was higher than on peer exchanges for this period.`,
      );
    } else if (kind === 'hit' && peersCrossed.length > 0) {
      const names = peersCrossed.map((p) => PEER_EXCHANGE_LABELS[p.exchange]).join(', ');
      paragraphs.push(
        `Peer mark prices on ${names} also ${side === 'Long' ? 'reached at or below' : 'reached at or above'} the liquidation level ${formatPrice(liquidationPrice)} in the same window, supporting that a liquidation at this level was consistent with broader market mark movement.`,
      );
    } else if (kind === 'miss' && peersNotCrossed.length === okPeers.length) {
      paragraphs.push(
        `Mudrex and all available peer marks failed to reach the reported liquidation price ${formatPrice(liquidationPrice)} in this window, which supports that a liquidation at the reported level is unlikely.`,
      );
    } else if (kind === 'miss' && peersCrossed.length > 0) {
      const names = peersCrossed.map((p) => PEER_EXCHANGE_LABELS[p.exchange]).join(', ');
      paragraphs.push(
        `Although Mudrex mark did not reach ${formatPrice(liquidationPrice)}, peer marks on ${names} did cross that level. The user may be comparing Mudrex liquidation rules to price action on other venues.`,
      );
    }

    const peerAbsMoves = okPeers.map((p) => Math.abs(p.markMovePct));
    const medianPeerAbs =
      peerAbsMoves.length > 0
        ? peerAbsMoves.sort((a, b) => a - b)[Math.floor(peerAbsMoves.length / 2)]
        : 0;

    if (okPeers.length > 0 && mudrexAbsMove > medianPeerAbs * 2 && medianPeerAbs > 0.05) {
      paragraphs.push(
        `Mudrex mark volatility (${mudrexAbsMove.toFixed(2)}% absolute window move) was materially larger than the median peer move (${medianPeerAbs.toFixed(2)}%), which may explain why the user saw different price behaviour on other exchanges.`,
      );
    }
  }

  for (const u of unavailable) {
    if (okPeers.length > 0) {
      paragraphs.push(
        `${PEER_EXCHANGE_LABELS[u.exchange]}: ${u.message}`,
      );
    }
  }

  const bullets: string[] = [
    `Mudrex window move: ${mudrexMarkMovePct >= 0 ? '+' : ''}${mudrexMarkMovePct.toFixed(2)}% · ${extremeLabel} mark: ${formatPrice(mudrexExtremeMark)}`,
  ];

  for (const p of okPeers) {
    bullets.push(
      `${PEER_EXCHANGE_LABELS[p.exchange]}: move ${p.markMovePct >= 0 ? '+' : ''}${p.markMovePct.toFixed(2)}%, ${extremeLabel} ${formatPrice(p.extremeMark)}, crossed liq: ${p.crossedLiq ? 'yes' : 'no'}`,
    );
  }

  for (const u of unavailable) {
    bullets.push(`${PEER_EXCHANGE_LABELS[u.exchange]}: ${u.status === 'not_listed' ? 'not listed / no data' : 'error'}`);
  }

  const agentReplyParts: string[] = [];

  if (okPeers.length === 0) {
    agentReplyParts.push(
      `We also attempted to compare Mudrex mark prices with peer exchanges (Bybit, Binance, Delta) for ${symbol} in the same time window, but mark data was not available from those venues for this symbol.`,
    );
  } else {
    const peerCrossText =
      okPeers.filter((p) => p.crossedLiq).length > 0
        ? `Some peer exchange marks also reached the liquidation level in the same window.`
        : `Peer exchange marks in the same window did not show the same extreme move to the liquidation level as Mudrex.`;

    agentReplyParts.push(
      `We compared Mudrex mark prices with ${okPeers.map((p) => PEER_EXCHANGE_LABELS[p.exchange]).join(', ')} for the same ±15 minute window.`,
      peerCrossText,
    );

    if (mudrexAbsMove > 0 && okPeers.length > 0) {
      const avgPeer = okPeers.reduce((s, p) => s + Math.abs(p.markMovePct), 0) / okPeers.length;
      if (mudrexAbsMove > avgPeer * 1.5 && avgPeer > 0.05) {
        agentReplyParts.push(
          `Mudrex mark moved ${mudrexAbsMove.toFixed(2)}% in that window versus roughly ${avgPeer.toFixed(2)}% on average across peers, which can explain different volatility versus other exchanges.`,
        );
      }
    }
  }

  return {
    headline,
    paragraphs,
    bullets,
    agentReply: agentReplyParts.join(' '),
  };
}

async function attachPeerExchangeData(
  base: LiquidationCheckResult,
  input: {
    peerExchanges?: PeerExchangeId[];
    normalizedSymbol: string;
    side: LiquidationSide;
    liquidationPrice: number;
    windowStart: number;
    windowEnd: number;
    markCandles: MarkCandle[];
    extremeMark: number;
    kind: 'hit' | 'miss';
  },
): Promise<LiquidationCheckResult> {
  const peers = input.peerExchanges?.filter(Boolean) ?? [];
  if (peers.length === 0 || base.kind === 'error') {
    return base;
  }

  const peerResults = await fetchPeerExchangesMark(
    peers,
    input.normalizedSymbol,
    input.windowStart,
    input.windowEnd,
    input.side,
    input.liquidationPrice,
  );

  const markOpen = input.markCandles[0][1];
  const markClose = input.markCandles[input.markCandles.length - 1][4];
  const mudrexMarkMovePct = pctFrom(markOpen, markClose);

  const peerAnalysis = buildPeerExchangeAnalysis({
    kind: input.kind,
    symbol: input.normalizedSymbol,
    side: input.side,
    liquidationPrice: input.liquidationPrice,
    mudrexExtremeMark: input.extremeMark,
    mudrexMarkMovePct,
    peerResults,
  });

  return { ...base, peerResults, peerAnalysis };
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

  if (input.timezone !== 'Asia/Kolkata' && input.timezone !== 'UTC') {
    return { kind: 'error', message: 'Timezone must be Asia/Kolkata or UTC.' };
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

  const typedMarks = markCandles as MarkCandle[];
  const { markLow, markHigh } = markWindowBounds(typedMarks);

  const priceVsMarkError = validatePricesAgainstMarkWindow({
    entryPrice,
    liquidationPrice,
    markLow,
    markHigh,
    symbol: normalizedSymbol,
  });
  if (priceVsMarkError) {
    return { kind: 'error', message: priceVsMarkError, asset: assetSummary };
  }

  const crossError = validateCrossInWindow({
    side: input.side,
    liquidationPrice,
    markLow,
    markHigh,
  });
  if (crossError) {
    return { kind: 'error', message: crossError, asset: assetSummary };
  }

  let extremeMark: number | null = null;
  let extremeTime: number | null = null;

  for (const candle of typedMarks) {
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

  const peerAttachInput = {
    peerExchanges: input.peerExchanges,
    normalizedSymbol,
    side: input.side,
    liquidationPrice,
    windowStart,
    windowEnd,
    markCandles: typedMarks,
    extremeMark,
    kind,
  };

  if (hit) {
    const result: LiquidationCheckResult = {
      kind: 'hit',
      extremeMark,
      extremeTime,
      markAtReport: reportMark?.[4],
      markOpen,
      markClose,
      markCandles: typedMarks,
      asset: assetSummary,
      analysis,
      message: `VALID: Mudrex mark price reached ${formatPrice(extremeMark)} at ${timeLabel}, crossing the liquidation threshold of ${formatPrice(liquidationPrice)}.${historicalNote}`,
    };
    return attachPeerExchangeData(result, peerAttachInput);
  }

  const result: LiquidationCheckResult = {
    kind: 'miss',
    extremeMark,
    extremeTime,
    markAtReport: reportMark?.[4],
    markOpen,
    markClose,
    markCandles: typedMarks,
    asset: assetSummary,
    analysis,
    message: `DID NOT REACH: The ${actualDir.toLowerCase()} Mudrex mark price in the window was ${formatPrice(extremeMark)} at ${timeLabel}. It did not ${expectedDir} the liquidation price of ${formatPrice(liquidationPrice)}.${historicalNote}`,
  };
  return attachPeerExchangeData(result, peerAttachInput);
}
