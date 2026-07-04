import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, Table2 } from 'lucide-react';
import { analyzePriceMovement } from './lib/analysis';
import { fetchPriceDataViaApi } from './lib/api-client';
import { validateLookup } from './lib/api';
import { buildCsv, buildCsvFilename, downloadCsv } from './lib/csv';
import { defaultStartTime, defaultEndTime } from './lib/time';
import { trackUsage } from './lib/usage-client';
import type { FetchResult, LookupParams, PriceAnalysis } from './lib/types';
import { AnalysisPanel } from './components/AnalysisPanel';
import { BlinkingEyes } from './components/BlinkingEyes';
import { Header } from './components/Header';
import { LiquidationArrow } from './components/LiquidationArrow';
import { LookupForm } from './components/LookupForm';
import { ResultsTable } from './components/ResultsTable';
import { SummaryCards } from './components/SummaryCards';
import { LiquidationCheck } from './components/LiquidationCheck';
import { LookupPriceChart } from './components/LookupPriceChart';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';

const defaultParams = (): LookupParams => ({
  symbol: 'BTC/USDT',
  startTime: defaultStartTime('Asia/Kolkata'),
  endTime: defaultEndTime('Asia/Kolkata'),
  timezone: 'Asia/Kolkata',
  aggregation: '1m',
});

function isFetchError(value: unknown): value is { message: string; retryable: boolean } {
  return typeof value === 'object' && value !== null && 'message' in value && !('rows' in value);
}

type ToolSection = 'lookup' | 'liquidation';

export default function App() {
  const [section, setSection] = useState<ToolSection>('lookup');
  const [params, setParams] = useState<LookupParams>(defaultParams);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [analysis, setAnalysis] = useState<PriceAnalysis | null>(null);
  const [apiError, setApiError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setApiError(null);
  }, [params]);

  useEffect(() => {
    trackUsage('page_load');
  }, []);

  const handleFetch = useCallback(async () => {
    const validationError = validateLookup(params);
    if (validationError) return;

    setLoading(true);
    setApiError(null);

    const response = await fetchPriceDataViaApi(params);

    if (isFetchError(response)) {
      setApiError({ message: response.message, retryable: response.retryable });
      setResult(null);
      setAnalysis(null);
    } else {
      setResult(response);
      setAnalysis(analyzePriceMovement(response, params.timezone));
    }

    setLoading(false);
  }, [params]);

  const handleDownload = () => {
    if (!result) return;
    const csv = buildCsv(result, params.timezone);
    const filename = buildCsvFilename(
      result.normalizedSymbol,
      params.startTime,
      params.endTime,
    );
    downloadCsv(csv, filename);
    trackUsage('csv_download', {
      symbol: result.normalizedSymbol,
      startTime: params.startTime,
      endTime: params.endTime,
      timezone: params.timezone,
      aggregation: params.aggregation,
      rowCount: result.summary.rowCount,
      csvFilename: filename,
    });
  };

  const hasResults = result !== null && !loading;

  return (
    <div className="flex h-dvh flex-col bg-background transition-colors duration-theme">
      <Header />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <div
            role="tablist"
            aria-label="Tool"
            className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={section === 'lookup'}
              onClick={() => setSection('lookup')}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                section === 'lookup'
                  ? 'border border-primary-border bg-primary-subtle text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <BlinkingEyes />
              Lookup
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={section === 'liquidation'}
              onClick={() => setSection('liquidation')}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                section === 'liquidation'
                  ? 'bg-destructive text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-destructive-subtle hover:text-destructive'
              }`}
            >
              <LiquidationArrow
                className={section === 'liquidation' ? '!text-primary-foreground' : ''}
              />
              Liquidation Check
            </button>
          </div>

          {section === 'lookup' && (
            <>
              <Card title="Lookup" icon={<BlinkingEyes />}>
                <LookupForm
                  params={params}
                  onChange={setParams}
                  onSubmit={handleFetch}
                  loading={loading}
                />
              </Card>

              {apiError && (
                <div className="alert-destructive flex flex-col gap-3 rounded-xl px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm">{apiError.message}</p>
                  {apiError.retryable && (
                    <Button variant="secondary" onClick={handleFetch} disabled={loading}>
                      <RefreshCw size={16} />
                      Retry
                    </Button>
                  )}
                </div>
              )}

              <Card
                title="Results"
                icon={<Table2 size={18} className="text-primary" />}
                action={
                  hasResults ? (
                    <Button variant="secondary" onClick={handleDownload}>
                      <Download size={16} />
                      Download CSV
                    </Button>
                  ) : undefined
                }
              >
                {hasResults && result && analysis && (
                  <>
                    <SummaryCards summary={result.summary} timezone={params.timezone} />
                    <LookupPriceChart rows={result.rows} symbol={result.normalizedSymbol} />
                    <AnalysisPanel analysis={analysis} />
                  </>
                )}
                <ResultsTable
                  rows={result?.rows ?? []}
                  timezone={params.timezone}
                  loading={loading}
                />
              </Card>
            </>
          )}

          {section === 'liquidation' && (
            <Card
              title="Liquidation Check"
              icon={<LiquidationArrow />}
            >
              <LiquidationCheck />
            </Card>
          )}
        </div>
      </main>

      <footer className="sticky bottom-0 z-50 shrink-0 border-t border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <div>Internal tool · Public market data · No auth</div>
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <img
                src="/mudrex-logo.png"
                alt="Mudrex"
                className="h-5 w-5 rounded-sm object-cover"
              />
              <span>Powered by Mudrex API</span>
            </div>
            <span className="hidden sm:inline text-border">·</span>
            <div className="flex items-center gap-2">
              <span>Developed by Jithin Mohandas</span>
              <a
                href="https://github.com/DecentralizedJM"
                target="_blank"
                rel="noreferrer"
                className="text-foreground hover:text-primary-glow transition-colors"
                title="GitHub Profile"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
