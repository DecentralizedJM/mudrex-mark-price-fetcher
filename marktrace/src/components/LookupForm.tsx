import { useEffect, useRef, useState } from 'react';
import { getRangeWarning } from '../lib/api';
import { filterSymbols, loadSymbolSuggestions } from '../lib/symbols';
import { todayInTimezone } from '../lib/time';
import {
  AGGREGATION_OPTIONS,
  TIMEZONE_OPTIONS,
  type LookupParams,
  type TimezoneId,
} from '../lib/types';
import { Button } from './ui/Button';
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

  const rangeWarning = getRangeWarning(params);

  const update = <K extends keyof LookupParams>(key: K, value: LookupParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const handleTimezoneChange = (timezone: TimezoneId) => {
    onChange({
      ...params,
      timezone,
      date: params.date || todayInTimezone(timezone),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div ref={wrapperRef} className="relative">
        <Input
          label="Symbol"
          placeholder="ESPORTS/USDT"
          value={params.symbol}
          onChange={(e) => update('symbol', e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          autoComplete="off"
          required
        />
        {showSuggestions && filtered.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border-light bg-white shadow-lg dark:border-border-dark dark:bg-card-dark">
            {filtered.map((symbol) => (
              <li key={symbol}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Date"
          type="date"
          value={params.date}
          onChange={(e) => update('date', e.target.value)}
          required
        />
        <Select
          label="Timezone"
          value={params.timezone}
          onChange={(e) => handleTimezoneChange(e.target.value as TimezoneId)}
          options={TIMEZONE_OPTIONS}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Start time"
          type="time"
          value={params.startTime}
          onChange={(e) => update('startTime', e.target.value)}
          required
        />
        <Input
          label="End time"
          type="time"
          value={params.endTime}
          onChange={(e) => update('endTime', e.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label="Interval"
          value={params.aggregation}
          onChange={(e) => update('aggregation', e.target.value as LookupParams['aggregation'])}
          options={AGGREGATION_OPTIONS}
        />
        <Input
          label="Buffer (minutes)"
          type="number"
          min={0}
          max={120}
          step={1}
          value={params.bufferMinutes}
          onChange={(e) => update('bufferMinutes', Math.max(0, Number(e.target.value) || 0))}
        />
        <Input
          label="Reference time (T) — optional"
          type="time"
          value={params.referenceTime ?? ''}
          onChange={(e) => update('referenceTime', e.target.value || undefined)}
        />
      </div>

      {rangeWarning && (
        <div className="rounded-lg border border-warning/30 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-warning/40 dark:bg-amber-950/30 dark:text-amber-200">
          {rangeWarning}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? 'Fetching…' : 'Fetch prices'}
        </Button>
      </div>
    </form>
  );
}
