import { ThemeToggle } from './ThemeToggle';
import { CandleStream } from './CandleStream';

export function Header() {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="shrink-0">
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-primary-light dark:text-primary-dark">
            PriceFetch
          </h1>
          <CandleStream />
        </div>
        <p className="mt-1 text-sm text-secondary-light dark:text-secondary-dark">
          Mudrex LTP &amp; Mark Price Lookup
        </p>
      </div>
      <ThemeToggle />
    </header>
  );
}
