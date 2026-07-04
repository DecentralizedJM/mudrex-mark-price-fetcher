import { useEffect, useRef, useState } from 'react';
import { getRangeWarning, validateLookup } from '../lib/api';
import { filterSymbols, loadSymbolSuggestions } from '../lib/symbols';
import {
  AGGREGATION_OPTIONS,
  TIMEZONE_OPTIONS,
  type LookupParams,
  type TimezoneId,
} from '../lib/types';
import { Button } from './ui/Button';
import { DateTime24Input } from './ui/DateTime24Input';
import { Input } from './ui/Input';
import { Select } from './ui/Select';

interface LookupFormProps {
  params: LookupParams;
  onChange: (params: LookupParams) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function LookupForm({ params, onChange, onSubmit, loading }: LookupFormProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSymbolSuggestions().then(setSuggestions);
  }, []);

  useEffect(() => {
    setFiltered(filterSymbols(suggestions, params.symbol));
  }, [params.symbol, suggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const validationError = validateLookup(params);
  const rangeWarning = getRangeWarning(params);
  const canFetch = !validationError && !loading;

  const update = <K extends keyof LookupParams>(key: K, value: LookupParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const handleTimezoneChange = (timezone: TimezoneId) => {
    onChange({
      ...params,
      timezone,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFetch) return;
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-8 items-end">
        <div ref={wrapperRef} className="relative sm:col-span-2 lg:col-span-2">
          <Input
            label="Symbol"
            placeholder="ESPORTS/USDT"
            value={params.symbol}
            onChange={(e) => update('symbol', e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            autoComplete="off"
            className="w-full uppercase"
            required
          />
          {showSuggestions && filtered.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-card shadow-panel">
              {filtered.map((symbol) => (
                <li key={symbol}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onMouseDown={() => {
                      update('symbol', symbol);
                      setShowSuggestions(false);
                    }}
                  >
                    {symbol}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
          <DateTime24Input
            label="Start date & time"
            value={params.startTime}
            onChange={(value) => update('startTime', value)}
            required
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
          <DateTime24Input
            label="End date & time"
            value={params.endTime}
            onChange={(value) => update('endTime', value)}
            required
          />
        </div>

        <div className="sm:col-span-1 lg:col-span-1">
          <Select
            label="Interval"
            value={params.aggregation}
            onChange={(e) => update('aggregation', e.target.value as LookupParams['aggregation'])}
            options={AGGREGATION_OPTIONS}
          />
        </div>

        <div className="sm:col-span-1 lg:col-span-1">
          <Select
            label="Timezone"
            value={params.timezone}
            onChange={(e) => handleTimezoneChange(e.target.value as TimezoneId)}
            options={TIMEZONE_OPTIONS}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={!canFetch || loading} className="w-full sm:w-auto">
          {loading ? 'Fetching…' : 'Fetch prices'}
        </Button>
      </div>

      {validationError && (
        <div className="alert-destructive rounded-lg px-4 py-3 text-sm">
          {validationError}
        </div>
      )}

      {rangeWarning && (
        <div className="alert-warning rounded-lg px-4 py-3 text-sm">
          {rangeWarning}
        </div>
      )}
    </form>
  );
}
