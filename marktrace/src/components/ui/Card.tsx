import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, icon, action, children, className = '' }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-border-light bg-card-light shadow-card dark:border-border-dark dark:bg-card-dark dark:shadow-none ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4 dark:border-border-dark">
          {title && (
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-primary-light dark:text-primary-dark">
              {icon}
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
