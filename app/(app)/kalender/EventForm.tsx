'use client';

import { useActionState } from 'react';
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
  return (
    <form action={action} className="card">
      {editing && <input type="hidden" name="eventId" value={initial.eventId} />}
      {!editing && (
        <div className="field">
          <label htmlFor="type">Type</label>
          <select id="type" name="type" defaultValue="aften">
            {isOfficer && <option value="raid">Raid</option>}
            <option value="aften">Aften</option>
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="title">Titel</label>
        <input id="title" name="title" required maxLength={100} defaultValue={initial?.title} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="date">Dato</label>
        <input id="date" name="date" type="date" required defaultValue={initial?.date} />
      </div>
      <div className="field">
        <label htmlFor="time">Tidspunkt</label>
        <input id="time" name="time" type="time" required defaultValue={initial?.time} />
      </div>
      <div className="field">
        <label htmlFor="durationMinutes">Varighed i minutter (valgfri, 15–720)</label>
        <input
          id="durationMinutes"
          name="durationMinutes"
          type="number"
          min={15}
          max={720}
          step={1}
          defaultValue={initial?.durationMinutes ?? ''}
        />
      </div>
      <div className="field">
        <label htmlFor="description">Beskrivelse</label>
        <textarea id="description" name="description" rows={4} maxLength={2000} defaultValue={initial?.description} />
      </div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? 'Gemmer …' : editing ? 'Gem ændringer' : 'Opret event'}
      </button>
    </form>
  );
}
