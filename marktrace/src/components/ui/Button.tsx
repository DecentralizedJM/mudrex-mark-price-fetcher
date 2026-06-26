import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
}

const variants = {
  primary:
    'bg-accent text-white hover:bg-blue-600 dark:bg-accent-dark dark:hover:bg-blue-500 shadow-sm',
  secondary:
    'bg-white text-primary-light border border-border-light hover:bg-neutral-50 dark:bg-card-dark dark:text-primary-dark dark:hover:bg-neutral-900',
  ghost:
    'bg-transparent text-secondary-light hover:bg-neutral-100 dark:text-secondary-dark dark:hover:bg-neutral-900',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
