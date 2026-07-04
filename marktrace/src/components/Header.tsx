import { AboutButton } from './AboutButton';
import { ThemeToggle } from './ThemeToggle';
import { CandleStream } from './CandleStream';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
        <div className="min-w-0 shrink-0">
          <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 5v4" />
            <rect width="4" height="6" x="7" y="9" rx="1" />
            <path d="M9 15v2" />
            <path d="M17 3v2" />
            <rect width="4" height="8" x="15" y="5" rx="1" />
            <path d="M17 13v6" />
            <path d="M3 3v18h18" />
          </svg>
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            PriceFetcher
          </h1>
          <CandleStream />
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Mudrex LTP &amp; Mark Price Lookup
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-start">
          <AboutButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
