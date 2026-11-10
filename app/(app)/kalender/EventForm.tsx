'use client';

import { useActionState } from 'react';
import { TimeField } from '@/components/TimeField';
import { submitHandler, useFormValues } from '@/components/useFormValues';
import { createEventAction, updateEventAction, type FormState } from './actions';

export type EventFormValues = {
  eventId?: number;
  type: 'raid' | 'aften';
  title: string;
  date: string;
  time: string;
  durationMinutes: number | null;
  description: string;
};

export function EventForm({ isOfficer, initial }: { isOfficer: boolean; initial?: EventFormValues }) {
  const editing = initial?.eventId !== undefined;
  const [state, action, pending] = useActionState<FormState, FormData>(
    editing ? updateEventAction : createEventAction,
    {},
  );
  const { bind } = useFormValues({
    type: 'aften',
    title: initial?.title ?? '',
    date: initial?.date ?? '',
    time: initial?.time ?? '',
    durationMinutes: initial?.durationMinutes?.toString() ?? '',
    description: initial?.description ?? '',
  });
  return (
    <form onSubmit={submitHandler(action)} className="card">
      {editing && <input type="hidden" name="eventId" value={initial.eventId} />}
      {!editing && (
        <div className="field">
          <label htmlFor="type">Type</label>
          <select id="type" {...bind('type')}>
            {isOfficer && <option value="raid">Raid</option>}
            <option value="aften">Aften</option>
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="title">Titel</label>
        <input id="title" {...bind('title')} required maxLength={100} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="date">Dato</label>
        <input id="date" {...bind('date')} type="date" required />
      </div>
      <div className="field">
        <label id="time-label" htmlFor="time">Tidspunkt (24 timer)</label>
        <TimeField id="time" {...bind('time')} required />
      </div>
      <div className="field">
        <label htmlFor="durationMinutes">Varighed i minutter (valgfri, 15–720)</label>
        <input
          id="durationMinutes"
          {...bind('durationMinutes')}
          type="number"
          min={15}
          max={720}
          step={1}
        />
      </div>
      <div className="field">
        <label htmlFor="description">Beskrivelse</label>
        <textarea id="description" {...bind('description')} rows={4} maxLength={2000} />
      </div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? 'Gemmer …' : editing ? 'Gem ændringer' : 'Opret event'}
      </button>
    </form>
  );
}
