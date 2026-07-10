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
  /** Use object-cover to crop excess padding (Delta) */
  cover?: boolean;
  /** Wordmark-style logo — tile width follows image aspect */
  wide?: boolean;
};

const SQUARE_TILE = {
  compact: { size: 22, mark: 16 },
  regular: { size: 25, mark: 18 },
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
    compactHeight: SQUARE_TILE.compact.mark,
    height: SQUARE_TILE.regular.mark,
  },
  delta: {
    src: '/exchanges/delta.png',
    aspect: 598 / 498,
    compactHeight: 13,
    height: 15,
    cover: true,
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

  const tile = compact ? SQUARE_TILE.compact : SQUARE_TILE.regular;
  const tileSize = cfg.cover ? tile.size : markHeight + padY;

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-black"
      style={{ width: tileSize, height: tileSize }}
    >
      <img
        src={cfg.src}
        alt=""
        draggable={false}
        className={`block shrink-0 object-center ${cfg.cover ? 'object-cover' : 'object-contain'}`}
        style={{ height: markHeight, width: markHeight }}
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
