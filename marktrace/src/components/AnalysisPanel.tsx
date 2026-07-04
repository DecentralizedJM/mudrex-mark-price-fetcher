import { AlertTriangle, Info } from 'lucide-react';
import type { PriceAnalysis } from '../lib/types';

interface AnalysisPanelProps {
  analysis: PriceAnalysis;
}

const severityStyles = {
  neutral: {
    border: 'border-border',
    bg: 'bg-muted/50',
    icon: Info,
    iconClass: 'text-primary',
  },
  warning: {
    border: 'border-warning-border',
    bg: 'bg-warning-subtle',
    icon: AlertTriangle,
    iconClass: 'text-warning',
  },
  critical: {
    border: 'border-destructive-border',
    bg: 'bg-destructive-subtle',
    icon: AlertTriangle,
    iconClass: 'text-destructive',
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
            <h3 className="text-sm font-semibold text-foreground">
              Price movement analysis
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {analysis.headline}
            </p>
          </div>
          {analysis.paragraphs.map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
          {analysis.bullets.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
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
