import Link from 'next/link';
import { countsLabel, eventTypeLabel, formatTimeRange, groupByDay, rsvpLabel } from '@/lib/calendar-ui';
import { getDb } from '@/lib/db';
import { listUpcomingEvents } from '@/lib/events';
import { requireMember } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const member = await requireMember();
  const items = await listUpcomingEvents(getDb(), member.userId);
  const days = groupByDay(items);
  return (
    <>
      <h1>Kalender</h1>
      <div className="actions" style={{ marginBottom: 16 }}>
        <Link href="/kalender/ny" className="btn">Opret event</Link>
        {member.isOfficer && <Link href="/kalender/serier" className="btn secondary">Gentagne events</Link>}
      </div>
      {days.length === 0 && (
        <section className="card"><p className="muted">Ingen kommende events.</p></section>
      )}
      {days.map((day) => (
        <section key={day.date}>
          <h2>{day.label}</h2>
          {day.items.map((e) => (
            <Link key={e.id} href={`/kalender/${e.id}`} className={e.cancelled ? 'card event-card cancelled' : 'card event-card'}>
              <div>
                <span className="badge">{eventTypeLabel(e.type)}</span>{' '}
                <strong>{e.title}</strong>
                {e.cancelled && <> <span className="badge">Aflyst</span></>}
              </div>
              <div className="muted">
                {formatTimeRange(e.startsAt, e.durationMinutes)} · {countsLabel(e.counts)}
                {e.myStatus && <> · Din status: {rsvpLabel(e.myStatus)}</>}
              </div>
            </Link>
          ))}
        </section>
      ))}
    </>
  );
}
