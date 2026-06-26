import { useCallback, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { analyzePriceMovement } from './lib/analysis';
import { fetchPriceDataViaApi } from './lib/api-client';
import { buildCsv, buildCsvFilename, downloadCsv } from './lib/csv';
import { defaultStartTime, defaultEndTime } from './lib/time';
import type { FetchResult, LookupParams, PriceAnalysis } from './lib/types';
import { AnalysisPanel } from './components/AnalysisPanel';
import { Header } from './components/Header';
import { LookupForm } from './components/LookupForm';
import { ResultsTable } from './components/ResultsTable';
import { SummaryCards } from './components/SummaryCards';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';

const defaultParams = (): LookupParams => ({
  symbol: '',
  startTime: defaultStartTime('Asia/Kolkata'),
  endTime: defaultEndTime('Asia/Kolkata'),
  timezone: 'Asia/Kolkata',
  aggregation: '1m',
});

function isApiError(value: unknown): value is { message: string } {
  return typeof value === 'object' && value !== null && 'message' in value && !('rows' in value);
}

export default function App() {
  const [params, setParams] = useState<LookupParams>(defaultParams);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [analysis, setAnalysis] = useState<PriceAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetchPriceDataViaApi(params);

    if (isApiError(response)) {
      setError(response.message);
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
  };

  const hasResults = result !== null && !loading;

  return (
    <div className="flex min-h-screen flex-col bg-page-light transition-colors duration-theme dark:bg-page-dark">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        <Header />

        <div className="flex-1 space-y-6">
          <Card title="Lookup">
            <LookupForm
              params={params}
              onChange={setParams}
              onSubmit={handleFetch}
              loading={loading}
            />
          </Card>

          {error && (
            <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 dark:border-red-900/50 dark:bg-red-950/30 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              <Button variant="secondary" onClick={handleFetch} disabled={loading}>
                <RefreshCw size={16} />
                Retry
              </Button>
            </div>
          )}

          <Card
            title="Results"
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
                <AnalysisPanel analysis={analysis} />
              </>
            )}
            <ResultsTable
              rows={result?.rows ?? []}
              timezone={params.timezone}
              loading={loading}
            />
          </Card>
        </div>

        <footer className="mt-auto border-t border-border-light pt-6 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-secondary-light dark:border-border-dark dark:text-secondary-dark">
          <div>Internal tool · Public market data · No auth</div>
          <div className="flex items-center gap-2">
            <span>Developed by Jithin Mohandas</span>
            <a
              href="https://github.com/DecentralizedJM"
              target="_blank"
              rel="noreferrer"
              className="text-primary-light dark:text-primary-dark hover:text-accent dark:hover:text-accent-dark transition-colors"
              title="GitHub Profile"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
              </svg>
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
