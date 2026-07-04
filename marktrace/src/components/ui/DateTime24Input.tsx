const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const SECONDS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const fieldClass =
  'rounded-lg border border-border bg-input px-2 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-ring';

interface DateTime24InputProps {
  label: string;
  value: string; // YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss
  onChange: (value: string) => void;
  required?: boolean;
  id?: string;
  showSeconds?: boolean;
}

function splitValue(value: string): { date: string; hour: string; minute: string; second: string } {
  const [date = '', time = ''] = value.split('T');
  const [hour = '00', minute = '00', second = '00'] = time.split(':');
  return {
    date,
    hour: hour.padStart(2, '0').slice(0, 2),
    minute: minute.padStart(2, '0').slice(0, 2),
    second: second.padStart(2, '0').slice(0, 2),
  };
}

export function DateTime24Input({ label, value, onChange, required, id, showSeconds }: DateTime24InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  const { date, hour, minute, second } = splitValue(value);

  const emit = (nextDate: string, nextHour: string, nextMinute: string, nextSecond: string) => {
    if (!nextDate) {
      onChange('');
      return;
    }
    const timeStr = showSeconds ? `${nextHour}:${nextMinute}:${nextSecond}` : `${nextHour}:${nextMinute}`;
    onChange(`${nextDate}T${timeStr}`);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-1.5">
        <input
          id={inputId}
          type="date"
          value={date}
          required={required}
          onChange={(e) => emit(e.target.value, hour, minute, second)}
          className={`datetime-input min-h-[42px] w-full min-w-0 sm:flex-1 ${fieldClass}`}
        />
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <select
          aria-label={`${label} hour`}
          value={hour}
          required={required}
          onChange={(e) => emit(date, e.target.value, minute, second)}
          className={`min-h-[42px] w-[4.25rem] shrink-0 ${fieldClass}`}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="shrink-0 text-sm text-muted-foreground" aria-hidden>
          :
        </span>
        <select
          aria-label={`${label} minute`}
          value={minute}
          required={required}
          onChange={(e) => emit(date, hour, e.target.value, second)}
          className={`min-h-[42px] w-[4.25rem] shrink-0 ${fieldClass}`}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {showSeconds && (
          <>
            <span className="shrink-0 text-sm text-muted-foreground" aria-hidden>
              :
            </span>
            <select
              aria-label={`${label} second`}
              value={second}
              required={required}
              onChange={(e) => emit(date, hour, minute, e.target.value)}
              className={`min-h-[42px] w-[4.25rem] shrink-0 ${fieldClass}`}
            >
              {SECONDS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
