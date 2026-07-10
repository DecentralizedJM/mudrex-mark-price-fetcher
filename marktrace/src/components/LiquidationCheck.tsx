import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ShieldAlert, CheckCircle2, Check } from 'lucide-react';
import { filterSymbols, loadSymbolSuggestions, normalizeSymbol } from '../lib/symbols';
import { markCandlesToChart } from '../lib/chart-data';
import { getChartTheme } from '../lib/chart-theme';
import { parseLocalDateTime } from '../lib/time';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { DateTime24Input } from './ui/DateTime24Input';
import { LiquidationVisualPanel } from './LiquidationVisualPanel';
import { formatEpochForInput } from '../lib/time';
import { formatPrice } from '../lib/csv';
import type { MarkCandle, TimezoneId } from '../lib/types';

type PeerExchangeId = 'bybit' | 'binance' | 'delta';

const PEER_EXCHANGES: { id: PeerExchangeId; label: string }[] = [
  { id: 'bybit', label: 'Bybit' },
  { id: 'binance', label: 'Binance' },
  { id: 'delta', label: 'Delta' },
];

const ALL_PEER_IDS: PeerExchangeId[] = ['bybit', 'binance', 'delta'];

type PeerMarkResult =
  | {
      exchange: PeerExchangeId;
      status: 'ok';
      extremeMark: number;
      extremeTime: number;
      markOpen: number;
      markClose: number;
      markMovePct: number;
      crossedLiq: boolean;
    }
  | {
      exchange: PeerExchangeId;
      status: 'not_listed' | 'error';
      message: string;
    };

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
  markCandles?: MarkCandle[];
  analysis?: MovementAnalysis;
  peerResults?: PeerMarkResult[];
  peerAnalysis?: MovementAnalysis;
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
  const [peerCheckEnabled, setPeerCheckEnabled] = useState(false);
  const [selectedPeers, setSelectedPeers] = useState<PeerExchangeId[]>(ALL_PEER_IDS);

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
  }, [symbol, side, leverage, entryPrice, liqPrice, liqTime, timezone, peerCheckEnabled, selectedPeers]);

  const togglePeerExchange = (id: PeerExchangeId) => {
    setSelectedPeers((prev) => {
      if (prev.includes(id)) {
        return prev.filter((p) => p !== id);
      }
      return [...prev, id];
    });
  };

  const handlePeerCheckToggle = (enabled: boolean) => {
    setPeerCheckEnabled(enabled);
    if (enabled && selectedPeers.length === 0) {
      setSelectedPeers(ALL_PEER_IDS);
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

    if (peerCheckEnabled && selectedPeers.length === 0) {
      setClientError('Select at least one peer exchange for comparison.');
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
          ...(peerCheckEnabled && selectedPeers.length > 0
            ? { peerExchanges: selectedPeers }
            : {}),
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

  const chartCandles = useMemo(
    () => (result?.markCandles ? markCandlesToChart(result.markCandles) : []),
    [result?.markCandles],
  );

  const chartOverlays = useMemo(() => {
    if (!result?.markCandles?.length) {
      return { priceLines: [], markers: [] };
    }

    const theme = getChartTheme();
    const entry = Number(entryPrice);
    const liq = Number(liqPrice);
    const priceLines = [];

    if (Number.isFinite(entry) && entry > 0) {
      priceLines.push({
        price: entry,
        title: `Entry ${formatPrice(entry)}`,
        color: theme.primary,
      });
    }
    if (Number.isFinite(liq) && liq > 0) {
      priceLines.push({
        price: liq,
        title: `Liq ${formatPrice(liq)}`,
        color: theme.destructive,
      });
    }

    const markers = [];
    try {
      const reportedEpoch = Math.floor(parseLocalDateTime(liqTime, timezone).getTime() / 1000);
      markers.push({
        time: reportedEpoch,
        text: 'Reported',
        position: 'aboveBar' as const,
        color: theme.warning,
        shape: 'arrowDown' as const,
      });
    } catch {
      // ignore invalid time for marker
    }

    if (result.extremeTime !== undefined) {
      markers.push({
        time: result.extremeTime,
        text: 'Extreme mark',
        position: side === 'Long' ? ('belowBar' as const) : ('aboveBar' as const),
        color: theme.up,
        shape: 'circle' as const,
      });
    }

    return { priceLines, markers };
  }, [result, entryPrice, liqPrice, liqTime, timezone, side]);

  return (
    <div className="space-y-6">
      <form onSubmit={handleCheck} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 items-end">
          <div ref={wrapperRef} className="relative md:col-span-2 lg:col-span-2">
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
              <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-card shadow-panel">
                {filtered.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
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

          <div className="md:col-span-1 lg:col-span-1">
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

          <div className="md:col-span-1 lg:col-span-1">
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

          <div className="md:col-span-1 lg:col-span-1">
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

          <div className="md:col-span-1 lg:col-span-1">
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

          <div className="md:col-span-2 lg:col-span-3">
            <DateTime24Input
              label="Reported Liquidation Time"
              value={liqTime}
              onChange={setLiqTime}
              showSeconds={true}
              required
            />
          </div>

          <div className="md:col-span-1 lg:col-span-1">
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

        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={peerCheckEnabled}
              onChange={(e) => handlePeerCheckToggle(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">Peer Exchange Check</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Compare Mudrex mark price with Bybit, Binance, and Delta mark data in the same ±15
                minute window.
              </span>
            </span>
          </label>

          {peerCheckEnabled && (
            <div className="flex flex-wrap gap-2 pl-7">
              {PEER_EXCHANGES.map(({ id, label }) => {
                const active = selectedPeers.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => togglePeerExchange(id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary-subtle text-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {clientError && (
          <div className="alert-destructive rounded-lg px-4 py-3 text-sm">
            {clientError}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
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
            <Activity className="h-10 w-10 animate-pulse text-primary" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary-ring border-t-primary" />
          </div>
          <p className="text-center text-sm font-medium text-muted-foreground">
            Checking Mudrex asset specs and mark price around {liqTime.replace('T', ' ')}
            {peerCheckEnabled && selectedPeers.length > 0
              ? ` · comparing with ${selectedPeers.length} peer exchange${selectedPeers.length > 1 ? 's' : ''}`
              : ''}
            …
          </p>
          <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status === 'result' && result && (
        <div className="space-y-4">
          {result.markCandles &&
            result.markCandles.length > 0 &&
            (result.kind === 'hit' || result.kind === 'miss') && (
              <LiquidationVisualPanel
                side={side}
                symbol={symbol}
                leverage={leverage}
                entryPrice={Number(entryPrice)}
                liqPrice={Number(liqPrice)}
                liqTime={liqTime}
                timezone={timezone}
                kind={result.kind}
                extremeMark={result.extremeMark}
                extremeTime={result.extremeTime}
                markAtReport={result.markAtReport}
                candles={chartCandles}
                priceLines={chartOverlays.priceLines}
                markers={chartOverlays.markers}
              />
            )}

          <div
            className={`animate-in rounded-xl border p-4 sm:p-6 ${
              result.kind === 'hit'
                ? 'alert-destructive'
                : result.kind === 'miss'
                  ? 'alert-success'
                  : 'alert-warning'
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="shrink-0 sm:mt-1">
                {result.kind === 'hit' ? (
                  <ShieldAlert className="h-7 w-7 text-destructive sm:h-8 sm:w-8" />
                ) : result.kind === 'miss' ? (
                  <CheckCircle2 className="h-7 w-7 text-success sm:h-8 sm:w-8" />
                ) : (
                  <ShieldAlert className="h-7 w-7 text-warning sm:h-8 sm:w-8" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold leading-snug text-foreground sm:text-lg">
                  {result.kind === 'hit' ? (
                    <>
                      <span>VERDICT: VALID LIQUIDATION</span>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success text-primary-foreground">
                        <Check size={14} strokeWidth={3} aria-hidden />
                      </span>
                    </>
                  ) : result.kind === 'miss' ? (
                    <>
                      <span className="sm:hidden">VERDICT: NO LIQ. WICK</span>
                      <span className="hidden sm:inline">VERDICT: NO LIQUIDATION WICK FOUND</span>
                    </>
                  ) : (
                    'CHECK REJECTED'
                  )}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {result.message}
                </p>

                {result.asset && (
                  <dl className="grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Mudrex asset</dt>
                      <dd className="font-medium text-foreground">
                        {result.asset.name} ({result.asset.symbol})
                        {!result.asset.currentlyListed ? ' · historical only' : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        Leverage range
                      </dt>
                      <dd className="font-medium text-foreground">
                        {result.asset.minLeverage}x to {result.asset.maxLeverage}x
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            </div>
          </div>

          {result.analysis && (
            <div className="animate-in surface-panel rounded-xl p-4 sm:p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Price movement analysis
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {result.analysis.headline}
                </p>
              </div>

              <div className="space-y-3">
                {result.analysis.paragraphs.map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-sm leading-relaxed text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
                {result.analysis.bullets.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {result.analysis.bullets.map((bullet, i) => (
                      <li key={i}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-5 rounded-lg border border-border bg-muted/50 p-4">
                <h4 className="meta-label">
                  Suggested user reply
                </h4>
                <p className="mt-2 select-text text-sm leading-relaxed text-foreground">
                  {result.analysis.agentReply}
                </p>
              </div>
            </div>
          )}

          {result.peerAnalysis && (
            <div className="animate-in surface-panel rounded-xl p-4 sm:p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">Peer exchange analysis</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {result.peerAnalysis.headline}
                </p>
              </div>

              {result.peerResults && result.peerResults.length > 0 && (
                <div className="mb-4 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">
                          Exchange
                        </th>
                        <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">
                          Status
                        </th>
                        <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">
                          Window move
                        </th>
                        <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">
                          Extreme mark
                        </th>
                        <th className="px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground">
                          Crossed liq
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.peerResults.map((peer) => {
                        const label =
                          PEER_EXCHANGES.find((p) => p.id === peer.exchange)?.label ?? peer.exchange;
                        return (
                          <tr key={peer.exchange} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 font-medium text-foreground">{label}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {peer.status === 'ok'
                                ? 'OK'
                                : peer.status === 'not_listed'
                                  ? 'Not listed'
                                  : 'Error'}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">
                              {peer.status === 'ok'
                                ? `${peer.markMovePct >= 0 ? '+' : ''}${peer.markMovePct.toFixed(2)}%`
                                : '—'}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">
                              {peer.status === 'ok' ? formatPrice(peer.extremeMark) : '—'}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {peer.status === 'ok' ? (peer.crossedLiq ? 'Yes' : 'No') : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="space-y-3">
                {result.peerAnalysis.paragraphs.map((paragraph, i) => (
                  <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
                {result.peerAnalysis.bullets.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {result.peerAnalysis.bullets.map((bullet, i) => (
                      <li key={i}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>

              {result.peerAnalysis.agentReply && (
                <div className="mt-5 rounded-lg border border-border bg-muted/50 p-4">
                  <h4 className="meta-label">Peer comparison note for tickets</h4>
                  <p className="mt-2 select-text text-sm leading-relaxed text-foreground">
                    {result.peerAnalysis.agentReply}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
