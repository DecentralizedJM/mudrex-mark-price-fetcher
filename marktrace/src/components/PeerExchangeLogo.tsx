export type PeerExchangeId = 'bybit' | 'binance' | 'delta';

export const PEER_EXCHANGES: { id: PeerExchangeId; label: string }[] = [
  { id: 'bybit', label: 'Bybit' },
  { id: 'binance', label: 'Binance' },
  { id: 'delta', label: 'Delta' },
];

type LogoConfig = {
  src: string;
  /** Natural width / height of the source asset */
  aspect: number;
  /** Display height inside the tile (px) */
  compactHeight: number;
  height: number;
  /** Crop zoom for assets with excess padding (Delta) */
  zoom?: number;
  /** Wordmark-style logo — tile width follows image aspect */
  wide?: boolean;
};

const LOGO_CONFIG: Record<PeerExchangeId, LogoConfig> = {
  bybit: {
    src: '/exchanges/bybit.png',
    aspect: 434 / 230,
    compactHeight: 12,
    height: 14,
    wide: true,
  },
  binance: {
    src: '/exchanges/binance.png',
    aspect: 1,
    compactHeight: 16,
    height: 18,
  },
  delta: {
    src: '/exchanges/delta.png',
    aspect: 598 / 498,
    compactHeight: 22,
    height: 26,
    zoom: 2.4,
  },
};

function LogoTile({ id, compact }: { id: PeerExchangeId; compact: boolean }) {
  const cfg = LOGO_CONFIG[id];
  const markHeight = compact ? cfg.compactHeight : cfg.height;
  const padY = compact ? 6 : 7;

  if (cfg.wide) {
    const markWidth = Math.round(markHeight * cfg.aspect);
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-black px-1.5"
        style={{ height: markHeight + padY, minWidth: markWidth + 12 }}
      >
        <img
          src={cfg.src}
          alt=""
          draggable={false}
          width={markWidth}
          height={markHeight}
          className="block shrink-0 object-contain object-center"
          style={{ height: markHeight, width: markWidth }}
        />
      </span>
    );
  }

  const tileSize = markHeight + padY;

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-black"
      style={{ width: tileSize, height: tileSize }}
    >
      <img
        src={cfg.src}
        alt=""
        draggable={false}
        className="block shrink-0 object-contain object-center"
        style={
          cfg.zoom
            ? { height: markHeight, width: 'auto', transform: `scale(${cfg.zoom})` }
            : { height: markHeight, width: markHeight }
        }
      />
    </span>
  );
}

export function PeerExchangeBrand({
  id,
  showLabel = true,
  compact = false,
}: {
  id: PeerExchangeId;
  showLabel?: boolean;
  compact?: boolean;
}) {
  const peer = PEER_EXCHANGES.find((p) => p.id === id);
  if (!peer) return null;

  return (
    <span className="inline-flex items-center gap-2">
      <LogoTile id={id} compact={compact} />
      {showLabel && <span>{peer.label}</span>}
    </span>
  );
}
