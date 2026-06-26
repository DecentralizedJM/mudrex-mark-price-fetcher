import { AlertTriangle, Info } from 'lucide-react';
import type { PriceAnalysis } from '../lib/types';

interface AnalysisPanelProps {
  analysis: PriceAnalysis;
}

const severityStyles = {
  neutral: {
    border: 'border-border-light dark:border-border-dark',
    bg: 'bg-neutral-50/80 dark:bg-neutral-900/40',
    icon: Info,
    iconClass: 'text-accent dark:text-accent-dark',
  },
  warning: {
    border: 'border-warning/40',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    icon: AlertTriangle,
    iconClass: 'text-warning',
  },
  critical: {
    border: 'border-red-500/40',
    bg: 'bg-red-50 dark:bg-red-950/30',
    icon: AlertTriangle,
    iconClass: 'text-red-600 dark:text-red-400',
  },
};

export function AnalysisPanel({ analysis }: AnalysisPanelProps) {
  const style = severityStyles[analysis.severity];
  const Icon = style.icon;

  return (
    <div className={`mb-5 rounded-lg border px-4 py-4 ${style.border} ${style.bg}`}>
      <div className="flex gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClass}`} />
        <div className="min-w-0 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-primary-light dark:text-primary-dark">
              Price movement analysis
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-secondary-light dark:text-secondary-dark">
              {analysis.headline}
            </p>
          </div>
          {analysis.paragraphs.map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed text-secondary-light dark:text-secondary-dark">
              {paragraph}
            </p>
          ))}
          {analysis.bullets.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-secondary-light dark:text-secondary-dark">
              {analysis.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
