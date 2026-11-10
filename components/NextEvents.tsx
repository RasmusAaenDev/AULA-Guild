import Link from 'next/link';
import { RsvpButtons } from '@/components/RsvpButtons';
import { formatDayHeading, formatTimeRange, rsvpLabel } from '@/lib/calendar-ui';
import { getDb } from '@/lib/db';
import { listUpcomingEvents, type EventListItem } from '@/lib/events';

function Next({ title, empty, event, hasCharacter }: { title: string; empty: string; event: EventListItem | undefined; hasCharacter: boolean }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {event ? (
        <>
          <p>
            <Link href={`/kalender/${event.id}`}><strong>{event.title}</strong></Link>
            {' · '}{formatDayHeading(event.startsAt)} kl. {formatTimeRange(event.startsAt, event.durationMinutes)}
          </p>
          <p className="muted">{event.myStatus ? `Din status: ${rsvpLabel(event.myStatus)}` : 'Du har ikke svaret endnu'}</p>
          {hasCharacter ? (
            <RsvpButtons eventId={event.id} current={event.myStatus} />
          ) : (
            <p><Link href="/karakter/ny">Tilføj karakter</Link> for at tilmelde dig.</p>
          )}
        </>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </section>
  );
}

export async function NextEvents({ userId, hasCharacter }: { userId: number; hasCharacter: boolean }) {
  const now = new Date();
  const items = (await listUpcomingEvents(getDb(), userId, now, { limit: 100 })).filter(
    (e) => !e.cancelled && e.startsAt.getTime() > now.getTime(),
  );
  return (
    <>
      <Next title="Næste raid" empty="Ingen planlagte raids" event={items.find((e) => e.type === 'raid')} hasCharacter={hasCharacter} />
      <Next title="Næste aften" empty="Ingen planlagte aftener" event={items.find((e) => e.type === 'aften')} hasCharacter={hasCharacter} />
    </>
  );
}
