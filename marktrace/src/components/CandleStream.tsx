import { useEffect, useState } from 'react';

interface OhlcCandle {
  open: number;
  high: number;
  low: number;
  close: number;
}

const CANDLE_TYPES: OhlcCandle[] = [
  { open: 58, high: 75, low: 52, close: 54 },  // Bearish pin bar / shooting star
  { open: 40, high: 70, low: 40, close: 68 },  // Strong Bullish Marubozu
  { open: 60, high: 62, low: 58, close: 59 },  // Doji
  { open: 65, high: 68, low: 45, close: 48 },  // Bearish Engulfing
  { open: 50, high: 52, low: 25, close: 48 },  // Bullish Hammer
  { open: 55, high: 65, low: 45, close: 56 },  // Spinning top
  { open: 30, high: 70, low: 20, close: 65 },  // High volatility Bullish
  { open: 60, high: 65, low: 20, close: 25 },  // High volatility Bearish
  { open: 45, high: 55, low: 42, close: 52 },  // Standard Bullish
  { open: 55, high: 58, low: 45, close: 47 },  // Standard Bearish
];

const H = 40;
const W = 16;

export function CandleStream() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % CANDLE_TYPES.length);
    }, 600); // changes every 600ms
    return () => clearInterval(timer);
  }, []);

  const candle = CANDLE_TYPES[index];
  const bullish = candle.close >= candle.open;
  const bodyTop = Math.max(candle.open, candle.close);
  const bodyBottom = Math.min(candle.open, candle.close);

  const y = (p: number) => ((100 - p) / 100) * H;
  const highY = y(candle.high);
  const lowY = y(candle.low);
  const bodyTopY = y(bodyTop);
  const bodyBottomY = y(bodyBottom);
  const bodyH = Math.max(bodyBottomY - bodyTopY, 2);

  const fill = bullish ? '#089981' : '#f23645';
  const cx = W / 2;

  return (
    <div className="flex h-10 w-10 items-center justify-center overflow-hidden" aria-hidden="true">
      <svg
        key={index} // Force re-render for crisp animation if needed, or rely on CSS
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="animate-in zoom-in fade-in duration-300"
      >
        <line
          x1={cx}
          y1={highY}
          x2={cx}
          y2={lowY}
          stroke={fill}
          strokeWidth="1.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <rect
          x={cx - 3.5}
          y={bodyTopY}
          width={7}
          height={bodyH}
          fill={fill}
          rx="1"
        />
      </svg>
    </div>
  );
}
