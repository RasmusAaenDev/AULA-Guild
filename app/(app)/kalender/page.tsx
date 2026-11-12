import Link from 'next/link';
import { CreateMenu } from '@/components/CreateMenu';
import { UnansweredBanner } from '@/components/UnansweredBanner';
import { countsLabel, eventTypeLabel, formatTimeRange, groupByDay, rsvpLabel } from '@/lib/calendar-ui';
import { getDb } from '@/lib/db';
import { countUnansweredUpcoming, listUpcomingEvents } from '@/lib/events';
import { statusClass } from '@/lib/rsvp-ui';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const member = await requireUser();
  const db = getDb();
  const [items, unanswered] = await Promise.all([
    listUpcomingEvents(db, member.userId),
    countUnansweredUpcoming(db, member.userId),
  ]);
  const days = groupByDay(items);
  return (
    <>
      <UnansweredBanner count={unanswered} />
      <div className="section-head">
        <h1>Kalender</h1>
        <div className="actions">
          {member.isOfficer && <Link href="/kalender/serier" className="btn secondary">Gentagne events</Link>}
          <CreateMenu />
        </div>
      </div>
      {days.length === 0 && (
        <section className="card"><p className="muted">Ingen kommende events.</p></section>
      )}
      {days.map((day) => (
        <section key={day.date}>
          <h2>{day.label}</h2>
          {day.items.map((e) => (
            <Link key={e.id} href={`/kalender/${e.id}`} className={`card event-card ${statusClass(e.myStatus)}${e.cancelled ? ' cancelled' : ''}`}>
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
