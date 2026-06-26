import { useCallback, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { analyzePriceMovement } from './lib/analysis';
import { fetchPriceData } from './lib/api';
import { buildCsv, buildCsvFilename, downloadCsv } from './lib/csv';
import { todayInTimezone } from './lib/time';
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
  date: todayInTimezone('Asia/Kolkata'),
  startTime: '',
  endTime: '',
  timezone: 'Asia/Kolkata',
  aggregation: '1m',
  bufferMinutes: 0,
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

  const showLabel = Boolean(params.referenceTime);

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetchPriceData(params);

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
    const csv = buildCsv(result, params.timezone, showLabel);
    const filename = buildCsvFilename(
      result.normalizedSymbol,
      params.date,
      params.startTime,
      params.endTime,
    );
    downloadCsv(csv, filename);
  };

  const hasResults = result !== null && !loading;

  return (
    <div className="min-h-screen bg-page-light transition-colors duration-theme dark:bg-page-dark">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Header />

        <div className="space-y-6">
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
              showLabel={showLabel}
              loading={loading}
            />
          </Card>
        </div>

        <footer className="mt-10 border-t border-border-light pt-6 text-center text-xs text-secondary-light dark:border-border-dark dark:text-secondary-dark">
          Internal tool · Public market data · No auth
        </footer>
      </div>
    </div>
  );
}
