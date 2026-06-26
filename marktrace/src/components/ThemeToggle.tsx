import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-light bg-white text-primary-light transition-colors duration-theme hover:bg-neutral-50 dark:border-border-dark dark:bg-card-dark dark:text-primary-dark dark:hover:bg-neutral-900"
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
