'use client';

import { useActionState } from 'react';
import { clearRsvpAction, setRsvpAction, type FormState } from '@/app/(app)/kalender/actions';
import { rsvpLabel } from '@/lib/calendar-ui';
import { rsvpStatuses, type RsvpStatus } from '@/lib/db/schema';

/** Tre tilmeldingsknapper (aktiv status fremhævet) og «Fjern tilmelding»; viser serverens fejl. */
export function RsvpButtons({ eventId, current }: { eventId: number; current: RsvpStatus | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    (prev, formData) => (formData.get('status') === 'fjern' ? clearRsvpAction(prev, formData) : setRsvpAction(prev, formData)),
    {},
  );
  return (
    <form action={action}>
      <input type="hidden" name="eventId" value={eventId} />
      <div className="actions">
        {rsvpStatuses.map((s) => (
          <button
            key={s}
            type="submit"
            name="status"
            value={s}
            className={current === s ? 'btn' : 'btn secondary'}
            aria-pressed={current === s}
            disabled={pending}
          >
            {rsvpLabel(s)}
          </button>
        ))}
        {current && (
          <button type="submit" name="status" value="fjern" className="btn secondary" disabled={pending}>
            Fjern tilmelding
          </button>
        )}
      </div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
    </form>
  );
}
