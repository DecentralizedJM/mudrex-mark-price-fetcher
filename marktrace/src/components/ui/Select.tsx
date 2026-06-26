import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className = '', id, ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-primary-light dark:text-primary-dark">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`rounded-lg border border-border-light bg-white px-3 py-2.5 text-sm text-primary-light focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:border-border-dark dark:bg-page-dark dark:text-primary-dark ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
