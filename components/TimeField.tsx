'use client';

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

/**
 * Klokkeslæt i 24-timers format (HH:MM), uafhængigt af browserens/OS' sprogindstilling (`<input type="time">` viser AM/PM
 * hos nogle). Sendes som ét skjult felt med værdien «HH:MM», eller tomt, indtil begge dele er valgt.
 */
export function TimeField({
  id, name, value, onChange, required,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  required?: boolean;
}) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  const hour = m?.[1] ?? '';
  const minute = m?.[2] ?? '';
  const emit = (v: string) => onChange({ target: { value: v } } as React.ChangeEvent<HTMLInputElement>);
  const minutes = minute && !MINUTES.includes(minute) ? [...MINUTES, minute].sort() : MINUTES;
  return (
    <span className="time-field" role="group" aria-labelledby={`${id}-label`}>
      <input type="hidden" name={name} value={value} />
      <select
        id={id}
        aria-label="Time"
        required={required}
        value={hour}
        onChange={(e) => emit(e.target.value ? `${e.target.value}:${minute || '00'}` : '')}
      >
        <option value="">--</option>
        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      {' : '}
      <select
        aria-label="Minut"
        required={required}
        value={minute}
        disabled={!hour}
        onChange={(e) => emit(`${hour}:${e.target.value}`)}
      >
        {!hour && <option value="">--</option>}
        {minutes.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    </span>
  );
}
