import { useEffect, useRef, useState } from 'react';
import { Activity, ShieldAlert, CheckCircle2, Copy, Check } from 'lucide-react';
import { filterSymbols, loadSymbolSuggestions, normalizeSymbol } from '../lib/symbols';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { DateTime24Input } from './ui/DateTime24Input';
import { formatEpoch, formatEpochForInput } from '../lib/time';
import { formatPrice } from '../lib/csv';
import type { TimezoneId } from '../lib/types';

type MovementAnalysis = {
  headline: string;
  paragraphs: string[];
  bullets: string[];
  agentReply: string;
};

type CheckResult = {
  kind: 'hit' | 'miss' | 'error';
  message: string;
  extremeMark?: number;
  extremeTime?: number;
  markAtReport?: number;
  markOpen?: number;
  markClose?: number;
  analysis?: MovementAnalysis;
  asset?: {
    symbol: string;
    name: string;
    minLeverage: string;
    maxLeverage: string;
    minPrice: string;
    maxPrice: string;
    priceStep: string;
    currentlyListed: boolean;
  };
};

export function LiquidationCheck() {
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<'Long' | 'Short'>('Long');
  const [leverage, setLeverage] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [liqPrice, setLiqPrice] = useState('');
  const [timezone, setTimezone] = useState<TimezoneId>('Asia/Kolkata');
  const [liqTime, setLiqTime] = useState(() =>
    formatEpochForInput(Math.floor(Date.now() / 1000), 'Asia/Kolkata'),
  );

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<'idle' | 'checking' | 'result'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadSymbolSuggestions().then(setSuggestions);
  }, []);

  useEffect(() => {
    setFiltered(filterSymbols(suggestions, symbol));
  }, [symbol, suggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setClientError(null);
    setResult(null);
    setStatus('idle');
    setCopied(false);
  }, [symbol, side, leverage, entryPrice, liqPrice, liqTime, timezone]);

  const copyAgentReply = async () => {
    if (!result?.analysis?.agentReply) return;
    try {
      await navigator.clipboard.writeText(result.analysis.agentReply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleTimezoneChange = (next: TimezoneId) => {
    setTimezone(next);
    setLiqTime(formatEpochForInput(Math.floor(Date.now() / 1000), next));
  };

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      normalizeSymbol(symbol);
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'Invalid symbol format.');
      return;
    }

    if (!leverage.trim() || !entryPrice.trim() || !liqPrice.trim() || !liqTime.trim()) {
      setClientError('Symbol, leverage, entry price, liquidation price, and time are required.');
      return;
    }

    setStatus('checking');
    setProgress(0);
    setResult(null);
    setClientError(null);

    const timer = setInterval(() => {
      setProgress((p) => Math.min(p + 12, 90));
    }, 250);

    try {
      const response = await fetch('/api/liquidation/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          side,
          leverage,
          entryPrice,
          liquidationPrice: liqPrice,
          liquidationTime: liqTime,
          timezone,
        }),
      });

      const data = (await response.json()) as CheckResult;
      clearInterval(timer);
      setProgress(100);
      setResult(data);
      setTimeout(() => setStatus('result'), 400);
    } catch {
      clearInterval(timer);
      setStatus('result');
      setResult({
        kind: 'error',
        message: 'Network error while validating against Mudrex. Please try again.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleCheck} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 items-end">
          <div ref={wrapperRef} className="relative sm:col-span-2 lg:col-span-2">
            <Input
              label="Symbol"
              placeholder="ESPORTS/USDT"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              autoComplete="off"
              className="w-full uppercase"
              required
            />
            {showSuggestions && filtered.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border-light bg-white shadow-lg dark:border-border-dark dark:bg-card-dark">
                {filtered.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
                      onMouseDown={() => {
                        setSymbol(s);
                        setShowSuggestions(false);
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="sm:col-span-1 lg:col-span-1">
            <Select
              label="Side"
              value={side}
              onChange={(e) => setSide(e.target.value as 'Long' | 'Short')}
              options={[
                { value: 'Long', label: 'Long' },
                { value: 'Short', label: 'Short' },
              ]}
            />
          </div>

          <div className="sm:col-span-1 lg:col-span-1">
            <Input
              label="Leverage (x)"
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 10"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              required
            />
          </div>

          <div className="sm:col-span-1 lg:col-span-1">
            <Input
              label="Entry Price"
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 64000"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              required
            />
          </div>

          <div className="sm:col-span-1 lg:col-span-1">
            <Input
              label="Liquidation Price"
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 62500"
              value={liqPrice}
              onChange={(e) => setLiqPrice(e.target.value)}
              required
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <DateTime24Input
              label="Reported Liquidation Time"
              value={liqTime}
              onChange={setLiqTime}
              showSeconds={true}
              required
            />
          </div>

          <div className="sm:col-span-1 lg:col-span-1">
            <Select
              label="Timezone"
              value={timezone}
              onChange={(e) => handleTimezoneChange(e.target.value as TimezoneId)}
              options={[
                { value: 'Asia/Kolkata', label: 'IST' },
                { value: 'UTC', label: 'UTC' },
              ]}
            />
          </div>
        </div>

        {clientError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {clientError}
          </div>
        )}

        <p className="text-xs text-secondary-light dark:text-secondary-dark">
          Symbol, leverage, and price limits are validated against Mudrex futures asset specs. Mark
          price reach is verified from Mudrex mark-kline data.
        </p>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={status === 'checking'} className="w-full sm:w-auto">
            {status === 'checking' ? 'Validating on Mudrex…' : 'Run Liquidation Check'}
          </Button>
        </div>
      </form>

      {status === 'checking' && (
        <div className="flex flex-col items-center justify-center space-y-4 py-10 animate-in">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <Activity className="h-10 w-10 animate-pulse text-accent" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
          </div>
          <p className="text-center text-sm font-medium text-secondary-light dark:text-secondary-dark">
            Checking Mudrex asset specs and mark price around {liqTime.replace('T', ' ')}…
          </p>
          <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-border-light dark:bg-border-dark">
            <div
              className="h-full bg-accent transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status === 'result' && result && (
        <div className="space-y-4">
          <div
            className={`animate-in rounded-xl border p-6 ${
              result.kind === 'hit'
                ? 'border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20'
                : result.kind === 'miss'
                  ? 'border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-950/20'
                  : 'border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/20'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="mt-1 shrink-0">
                {result.kind === 'hit' ? (
                  <ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-500" />
                ) : result.kind === 'miss' ? (
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
                ) : (
                  <ShieldAlert className="h-8 w-8 text-amber-600 dark:text-amber-500" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <h3
                  className={`text-lg font-semibold ${
                    result.kind === 'hit'
                      ? 'text-red-900 dark:text-red-300'
                      : result.kind === 'miss'
                        ? 'text-green-900 dark:text-green-300'
                        : 'text-amber-900 dark:text-amber-300'
                  }`}
                >
                  {result.kind === 'hit'
                    ? 'VERDICT: VALID LIQUIDATION'
                    : result.kind === 'miss'
                      ? 'VERDICT: NO LIQUIDATION WICK FOUND'
                      : 'CHECK REJECTED'}
                </h3>
                <p
                  className={`text-sm leading-relaxed ${
                    result.kind === 'hit'
                      ? 'text-red-800 dark:text-red-200'
                      : result.kind === 'miss'
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-amber-800 dark:text-amber-200'
                  }`}
                >
                  {result.message}
                </p>

                {result.asset && (
                  <dl className="grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-secondary-light dark:text-secondary-dark">Mudrex asset</dt>
                      <dd className="font-medium text-primary-light dark:text-primary-dark">
                        {result.asset.name} ({result.asset.symbol})
                        {!result.asset.currentlyListed ? ' · historical only' : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-secondary-light dark:text-secondary-dark">
                        Leverage range
                      </dt>
                      <dd className="font-medium text-primary-light dark:text-primary-dark">
                        {result.asset.minLeverage}x – {result.asset.maxLeverage}x
                      </dd>
                    </div>
                    {result.extremeMark !== undefined && result.extremeTime !== undefined && (
                      <div className="sm:col-span-2">
                        <dt className="text-secondary-light dark:text-secondary-dark">
                          Extreme mark in window
                        </dt>
                        <dd className="font-medium text-primary-light dark:text-primary-dark">
                          {formatPrice(result.extremeMark)} at{' '}
                          {formatEpoch(result.extremeTime, timezone)}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            </div>
          </div>

          {result.analysis && (
            <div className="animate-in rounded-xl border border-border-light bg-card-light p-5 dark:border-border-dark dark:bg-card-dark">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-primary-light dark:text-primary-dark">
                    Price movement analysis
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-secondary-light dark:text-secondary-dark">
                    {result.analysis.headline}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={copyAgentReply}
                  className="shrink-0"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied' : 'Copy reply for user'}
                </Button>
              </div>

              <div className="space-y-3">
                {result.analysis.paragraphs.map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-sm leading-relaxed text-secondary-light dark:text-secondary-dark"
                  >
                    {paragraph}
                  </p>
                ))}
                {result.analysis.bullets.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-secondary-light dark:text-secondary-dark">
                    {result.analysis.bullets.map((bullet, i) => (
                      <li key={i}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-5 rounded-lg border border-border-light bg-neutral-50/80 p-4 dark:border-border-dark dark:bg-neutral-900/40">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-secondary-light dark:text-secondary-dark">
                  Suggested user reply
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-primary-light dark:text-primary-dark">
                  {result.analysis.agentReply}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
