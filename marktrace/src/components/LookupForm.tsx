import { useEffect, useRef, useState } from 'react';
import { getRangeWarning } from '../lib/api';
import { filterSymbols, loadSymbolSuggestions } from '../lib/symbols';
import {
  AGGREGATION_OPTIONS,
  TIMEZONE_OPTIONS,
  type LookupParams,
  type TimezoneId,
} from '../lib/types';
import { Search } from 'lucide-react';
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
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 items-end">
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

        <div className="sm:col-span-1 lg:col-span-1">
          <Input
            label="Start date & time"
            type="datetime-local"
            value={params.startTime}
            onChange={(e) => update('startTime', e.target.value)}
            required
            className="w-full"
          />
        </div>

        <div className="sm:col-span-1 lg:col-span-1">
          <Input
            label="End date & time"
            type="datetime-local"
            value={params.endTime}
            onChange={(e) => update('endTime', e.target.value)}
            required
            className="w-full"
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
        <Button type="submit" disabled={loading} className="w-full sm:w-auto relative overflow-hidden group">
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Fetching…
              <div className="absolute inset-0 flex translate-x-[150%] items-center justify-center animate-[search_1s_infinite]">
                <Search size={16} className="text-white/30" />
              </div>
            </span>
          ) : (
            'Fetch prices'
          )}
        </Button>
      </div>

      {rangeWarning && (
        <div className="rounded-lg border border-warning/30 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-warning/40 dark:bg-amber-950/30 dark:text-amber-200">
          {rangeWarning}
        </div>
      )}
    </form>
  );
}
