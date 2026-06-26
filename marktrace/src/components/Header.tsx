import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-primary-light dark:text-primary-dark">
            MarkTrace
          </h1>
          <span className="text-sm text-secondary-light dark:text-secondary-dark">by Mudrex</span>
        </div>
        <p className="mt-1 text-sm text-secondary-light dark:text-secondary-dark">
          Mudrex LTP &amp; Mark Price Lookup
        </p>
      </div>
      <ThemeToggle />
    </header>
  );
}
