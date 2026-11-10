import { clearRsvpAction, setRsvpAction } from '@/app/(app)/kalender/actions';
import { rsvpLabel } from '@/lib/calendar-ui';
import { rsvpStatuses, type RsvpStatus } from '@/lib/db/schema';

/** Tre tilmeldingsknapper (aktiv status fremhævet) og «Fjern tilmelding». */
export function RsvpButtons({
  eventId, current, disabled = false,
}: { eventId: number; current: RsvpStatus | null; disabled?: boolean }) {
  return (
    <div className="actions">
      {rsvpStatuses.map((s) => (
        <form key={s} action={setRsvpAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="status" value={s} />
          <button
            type="submit"
            className={current === s ? 'btn' : 'btn secondary'}
            aria-pressed={current === s}
            disabled={disabled}
          >
            {rsvpLabel(s)}
          </button>
        </form>
      ))}
      {current && (
        <form action={clearRsvpAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <button type="submit" className="btn secondary" disabled={disabled}>Fjern tilmelding</button>
        </form>
      )}
    </div>
  );
}
