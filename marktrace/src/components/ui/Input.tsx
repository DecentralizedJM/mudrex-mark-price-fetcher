import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-primary-light dark:text-primary-dark">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`rounded-lg border border-border-light bg-white px-3 py-2.5 text-sm text-primary-light placeholder:text-secondary-light/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:border-border-dark dark:bg-page-dark dark:text-primary-dark dark:placeholder:text-secondary-dark/70 ${className}`}
        {...props}
      />
    </div>
  );
}
