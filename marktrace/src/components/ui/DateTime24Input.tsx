const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const fieldClass =
  'rounded-lg border border-border-light bg-white px-2 py-2.5 text-sm text-primary-light focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:border-border-dark dark:bg-card-dark dark:text-primary-dark';

interface DateTime24InputProps {
  label: string;
  value: string; // YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  required?: boolean;
  id?: string;
}

function splitValue(value: string): { date: string; hour: string; minute: string } {
  const [date = '', time = ''] = value.split('T');
  const [hour = '00', minute = '00'] = time.split(':');
  return {
    date,
    hour: hour.padStart(2, '0').slice(0, 2),
    minute: minute.padStart(2, '0').slice(0, 2),
  };
}

export function DateTime24Input({ label, value, onChange, required, id }: DateTime24InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  const { date, hour, minute } = splitValue(value);

  const emit = (nextDate: string, nextHour: string, nextMinute: string) => {
    if (!nextDate) {
      onChange('');
      return;
    }
    onChange(`${nextDate}T${nextHour}:${nextMinute}`);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-primary-light dark:text-primary-dark">
        {label}
      </label>
      <div className="flex min-w-0 items-center gap-1.5">
        <input
          id={inputId}
          type="date"
          value={date}
          required={required}
          onChange={(e) => emit(e.target.value, hour, minute)}
          className={`datetime-input min-h-[42px] min-w-0 flex-1 ${fieldClass}`}
        />
        <select
          aria-label={`${label} hour`}
          value={hour}
          required={required}
          onChange={(e) => emit(date, e.target.value, minute)}
          className={`min-h-[42px] w-[4.25rem] shrink-0 ${fieldClass}`}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="shrink-0 text-sm text-secondary-light dark:text-secondary-dark" aria-hidden>
          :
        </span>
        <select
          aria-label={`${label} minute`}
          value={minute}
          required={required}
          onChange={(e) => emit(date, hour, e.target.value)}
          className={`min-h-[42px] w-[4.25rem] shrink-0 ${fieldClass}`}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
