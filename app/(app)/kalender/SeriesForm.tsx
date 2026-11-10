'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { submitHandler, useFormValues } from '@/components/useFormValues';
import { weekdayNames } from '@/lib/calendar-ui';
import { createSeriesAction, updateSeriesAction, type FormState } from './actions';

export type SeriesFormValues = {
  seriesId?: number;
  type: 'raid' | 'aften';
  title: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  description: string;
};

export function SeriesForm({ initial }: { initial?: SeriesFormValues }) {
  const editing = initial?.seriesId !== undefined;
  const [state, action, pending] = useActionState<FormState, FormData>(
    editing ? updateSeriesAction : createSeriesAction,
    {},
  );
  const { bind } = useFormValues({
    type: initial?.type ?? 'raid',
    title: initial?.title ?? '',
    weekday: String(initial?.weekday ?? 0),
    startTime: initial?.startTime ?? '',
    durationMinutes: String(initial?.durationMinutes ?? 120),
    description: initial?.description ?? '',
  });
  return (
    <form onSubmit={submitHandler(action)} className="card">
      <h2>{editing ? 'Redigér serie' : 'Opret serie'}</h2>
      {editing && <input type="hidden" name="seriesId" value={initial.seriesId} />}
      <div className="field">
        <label htmlFor="type">Type</label>
        <select id="type" {...bind('type')}>
          <option value="raid">Raid</option>
          <option value="aften">Aften</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="title">Titel</label>
        <input id="title" {...bind('title')} required maxLength={100} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="weekday">Ugedag</label>
        <select id="weekday" {...bind('weekday')}>
          {weekdayNames.map((n, i) => <option key={n} value={i}>{n}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="startTime">Klokkeslæt</label>
        <input id="startTime" {...bind('startTime')} type="time" required />
      </div>
      <div className="field">
        <label htmlFor="durationMinutes">Varighed i minutter (15–720)</label>
        <input
          id="durationMinutes"
          {...bind('durationMinutes')}
          type="number"
          required
          min={15}
          max={720}
          step={1}
        />
      </div>
      <div className="field">
        <label htmlFor="description">Beskrivelse</label>
        <textarea id="description" {...bind('description')} rows={3} maxLength={2000} />
      </div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <div className="actions">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Gemmer …' : editing ? 'Gem serie' : 'Opret serie'}
        </button>
        {editing && <Link href="/kalender/serier" className="btn secondary">Annullér</Link>}
      </div>
    </form>
  );
}
