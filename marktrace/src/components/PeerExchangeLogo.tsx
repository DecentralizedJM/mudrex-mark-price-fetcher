import type { SVGProps } from 'react';

export type PeerExchangeId = 'bybit' | 'binance' | 'delta';

export const PEER_EXCHANGES: { id: PeerExchangeId; label: string }[] = [
  { id: 'bybit', label: 'Bybit' },
  { id: 'binance', label: 'Binance' },
  { id: 'delta', label: 'Delta' },
];

type MarkProps = SVGProps<SVGSVGElement>;

function BybitMark({ className, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 58 16"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <text
        x="0"
        y="12.5"
        fill="#FFFFFF"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="11"
        fontWeight="700"
        letterSpacing="0.06em"
      >
        BY
      </text>
      <rect x="20" y="2" width="2.5" height="12" rx="0.5" fill="#F7A600" />
      <text
        x="25"
        y="12.5"
        fill="#FFFFFF"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="11"
        fontWeight="700"
        letterSpacing="0.06em"
      >
        BIT
      </text>
    </svg>
  );
}

function BinanceMark({ className, ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden xmlns="http://www.w3.org/2000/svg" {...props}>
      <g fill="#F3BA2F">
        <path d="M16 4l2.5 2.5L16 9l-2.5-2.5L16 4z" />
        <path d="M9.5 10.5l2.5 2.5-2.5 2.5-2.5-2.5 2.5-2.5zm13 0l2.5 2.5-2.5 2.5-2.5-2.5 2.5-2.5z" />
        <path d="M16 11l2.5 2.5L16 16l-2.5-2.5L16 11z" />
        <path d="M9.5 17.5l2.5 2.5-2.5 2.5-2.5-2.5 2.5-2.5zm13 0l2.5 2.5-2.5 2.5-2.5-2.5 2.5-2.5z" />
        <path d="M16 18l2.5 2.5L16 23l-2.5-2.5L16 18z" />
      </g>
    </svg>
  );
}

function DeltaMark({ className, ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 48 40" className={className} aria-hidden xmlns="http://www.w3.org/2000/svg" {...props}>
      <polygon fill="#FF6727" points="0,20 14,6 14,20" />
      <polygon fill="#FF6727" points="14,6 48,20 14,20" />
      <polygon fill="#00B464" points="14,34 14,20 48,20" />
    </svg>
  );
}

const MARKS: Record<PeerExchangeId, (props: MarkProps) => JSX.Element> = {
  bybit: BybitMark,
  binance: BinanceMark,
  delta: DeltaMark,
};

export function PeerExchangeMark({
  id,
  className = 'h-4 w-4',
}: {
  id: PeerExchangeId;
  className?: string;
}) {
  const Mark = MARKS[id];
  return <Mark className={className} />;
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

  const markClass =
    id === 'bybit'
      ? compact
        ? 'h-2.5 w-auto'
        : 'h-3 w-auto'
      : compact
        ? 'h-4 w-4'
        : 'h-5 w-5';

  const tileClass =
    id === 'bybit'
      ? compact
        ? 'inline-flex h-6 min-w-[3.25rem] shrink-0 items-center justify-center overflow-hidden rounded-md bg-black px-1'
        : 'inline-flex h-7 min-w-[3.75rem] shrink-0 items-center justify-center overflow-hidden rounded-md bg-black px-1.5'
      : compact
        ? 'inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black p-0.5'
        : 'inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black p-0.5';

  return (
    <span className="inline-flex items-center gap-2">
      <span className={tileClass}>
        <PeerExchangeMark id={id} className={markClass} />
      </span>
      {showLabel && <span>{peer.label}</span>}
    </span>
  );
}
