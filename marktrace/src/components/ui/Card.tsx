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
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          {title && (
            <h2 className="font-display flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
              {icon}
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}
