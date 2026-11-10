import Link from 'next/link';
import { RsvpButtons } from '@/components/RsvpButtons';
import { formatDayHeading, formatTimeRange, rsvpLabel } from '@/lib/calendar-ui';
import { getDb } from '@/lib/db';
import { listUpcomingEvents, type EventListItem } from '@/lib/events';

function Next({ title, empty, event, now }: { title: string; empty: string; event: EventListItem | undefined; now: Date }) {
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
          <RsvpButtons eventId={event.id} current={event.myStatus} disabled={event.startsAt.getTime() <= now.getTime()} />
        </>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </section>
  );
}

export async function NextEvents({ userId }: { userId: number }) {
  const now = new Date();
  const items = (await listUpcomingEvents(getDb(), userId, now, { limit: 100 })).filter(
    (e) => !e.cancelled && e.startsAt.getTime() > now.getTime(),
  );
  return (
    <>
      <Next title="Næste raid" empty="Ingen planlagte raids" event={items.find((e) => e.type === 'raid')} now={now} />
      <Next title="Næste aften" empty="Ingen planlagte aftener" event={items.find((e) => e.type === 'aften')} now={now} />
    </>
  );
}
