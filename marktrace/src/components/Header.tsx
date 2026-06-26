import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <svg className="h-6 w-6 text-accent dark:text-accent-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5v4"></path>
            <rect width="4" height="6" x="7" y="9" rx="1"></rect>
            <path d="M9 15v2"></path>
            <path d="M17 3v2"></path>
            <rect width="4" height="8" x="15" y="5" rx="1"></rect>
            <path d="M17 13v6"></path>
            <path d="M3 3v18h18"></path>
          </svg>
          <h1 className="text-2xl font-semibold tracking-tight text-primary-light dark:text-primary-dark">
            PriceFetch
          </h1>
        </div>
        <p className="mt-1 text-sm text-secondary-light dark:text-secondary-dark">
          Mudrex LTP &amp; Mark Price Lookup
        </p>
      </div>
      <ThemeToggle />
    </header>
  );
}