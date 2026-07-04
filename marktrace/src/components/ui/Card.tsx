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
    <section className={`surface-panel flex flex-col rounded-xl ${className}`}>
      {(title || action) && (
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          {title && (
            <h2 className="font-display flex min-w-0 items-center gap-2 text-base font-semibold tracking-tight text-foreground">
              {icon}
              <span className="truncate">{title}</span>
            </h2>
          )}
          {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
        </div>
      )}
      <div className="flex-1 p-4 sm:p-5">{children}</div>
    </section>
  );
}
