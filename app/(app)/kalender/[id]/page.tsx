import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { RsvpButtons } from '@/components/RsvpButtons';
import { cancelEventAction } from '../actions';
import { countsLabel, eventTypeLabel, formatDayHeading, formatTimeRange, rsvpLabel } from '@/lib/calendar-ui';
import { getDb } from '@/lib/db';
import { rsvpStatuses, users } from '@/lib/db/schema';
import { getEvent } from '@/lib/events';
import { roleLabel } from '@/lib/messages';
import { requireMember } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const member = await requireMember();
  const { id: rawId } = await params;
  const id = /^\d{1,9}$/.test(rawId) ? Number(rawId) : NaN;
  if (!Number.isInteger(id) || id <= 0) notFound();
  const db = getDb();
  const event = await getEvent(db, id);
  if (!event) notFound();
  const [user] = await db.select({ active: users.activeCharacterId }).from(users).where(eq(users.id, member.userId));
  const hasCharacter = user?.active != null;
  const mine = event.attendees.find((a) => a.userId === member.userId)?.status ?? null;
  const started = event.startsAt.getTime() <= Date.now();
  const closed = event.cancelled || started;
  const canManage = member.isOfficer || (event.type === 'aften' && event.createdBy === member.userId);

  return (
    <>
      <h1>{event.title}</h1>
      <section className={event.cancelled ? 'card cancelled' : 'card'}>
        <p>
          <span className="badge">{eventTypeLabel(event.type)}</span>
          {event.cancelled && <> <span className="badge">Aflyst</span></>}
        </p>
        <p>
          {formatDayHeading(event.startsAt)} kl. {formatTimeRange(event.startsAt, event.durationMinutes)}
        </p>
        <p className="muted">Oprettet af {event.creatorName}</p>
        {event.description && <p style={{ whiteSpace: 'pre-wrap' }}>{event.description}</p>}
        {canManage && !event.cancelled && (
          <div className="actions">
            <Link href={`/kalender/${event.id}/rediger`} className="btn secondary">Redigér</Link>
            <form action={cancelEventAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <button type="submit" className="btn danger">Aflys</button>
            </form>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Tilmelding</h2>
        {event.cancelled ? (
          <p className="muted">Eventet er aflyst, så tilmelding er lukket.</p>
        ) : started ? (
          <p className="muted">Eventet er begyndt, så tilmelding er lukket.</p>
        ) : !hasCharacter ? (
          <p>
            Du skal have en aktiv karakter for at tilmelde dig. <Link href="/karakter/ny">Tilføj karakter</Link>.
          </p>
        ) : (
          <>
            <p className="muted">{mine ? `Din status: ${rsvpLabel(mine)}` : 'Du har ikke svaret endnu'}</p>
            <RsvpButtons eventId={event.id} current={mine} disabled={closed} />
          </>
        )}
      </section>

      <section className="card">
        <h2>Deltagere</h2>
        <p className="muted">Deltager: {countsLabel(event.counts)}</p>
        {event.attendees.length === 0 && <p className="muted">Ingen har svaret endnu.</p>}
        {rsvpStatuses.map((s) => {
          const list = event.attendees.filter((a) => a.status === s);
          if (list.length === 0) return null;
          return (
            <div key={s}>
              <h3>{rsvpLabel(s)} ({list.length})</h3>
              <ul>
                {list.map((a) => (
                  <li key={a.userId}>
                    <strong>{a.characterName}</strong> · {a.className} · {roleLabel(a.role)}
                    <span className="muted"> ({a.userName})</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
      <p><Link href="/kalender">Tilbage til kalenderen</Link></p>
    </>
  );
}
