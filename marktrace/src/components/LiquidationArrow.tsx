interface LiquidationArrowProps {
  className?: string;
}

/** Red downward lightning bolt; animates falling like Lookup's blinking eyes. */
export function LiquidationArrow({ className = '' }: LiquidationArrowProps) {
  return (
    <span
      className={`liquidation-arrow inline-flex h-5 w-5 shrink-0 items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
        <path d="M13 2 4 14h6l-2 8 11-14h-7l1-6z" />
      </svg>
    </span>
  );
}
