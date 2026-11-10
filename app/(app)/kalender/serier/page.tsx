import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ConfirmForm } from '@/components/ConfirmForm';
import { deactivateSeriesAction } from '../actions';
import { SeriesForm } from '../SeriesForm';
import { eventTypeLabel, seriesKeptMessage, weekdayNames } from '@/lib/calendar-ui';
import { getDb } from '@/lib/db';
import { listSeries } from '@/lib/series';
import { parseId } from '@/lib/parse';
import { requireMember } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function SeriesPage({
  searchParams,
}: { searchParams: Promise<{ kept?: string; rediger?: string }> }) {
  const member = await requireMember();
  if (!member.isOfficer) redirect('/kalender');
  const { kept, rediger } = await searchParams;
  const series = await listSeries(getDb());
  const keptMessage = kept && /^\d{1,6}$/.test(kept) ? seriesKeptMessage(Number(kept)) : null;
  const editing = parseId(rediger) !== null ? series.find((s) => s.id === parseId(rediger)) : undefined;
  return (
    <>
      <h1>Gentagne events</h1>
      {keptMessage && <p className="card" role="status">{keptMessage}</p>}
      <div className="card table-wrap">
        {series.length === 0 ? (
          <p className="muted">Ingen serier endnu.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Titel</th><th>Type</th><th>Ugedag</th><th>Tid</th><th>Kommende</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.id} className={s.active ? undefined : 'left-guild'}>
                  <td><strong>{s.title}</strong></td>
                  <td>{eventTypeLabel(s.type)}</td>
                  <td>{weekdayNames[s.weekday]}</td>
                  <td>{s.startTime} ({s.durationMinutes} min)</td>
                  <td>{s.upcomingCount}</td>
                  <td>{s.active ? 'Aktiv' : 'Inaktiv'}</td>
                  <td>
                    <div className="actions">
                      <Link href={`/kalender/serier?rediger=${s.id}`} className="btn secondary">Redigér</Link>
                      {s.active && (
                <ConfirmForm
                          action={deactivateSeriesAction}
                          fields={{ seriesId: s.id }}
                          label="Deaktivér"
                          confirmText="Deaktivér serien? Kommende events uden tilmeldinger slettes. Er du sikker?"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing ? (
        <SeriesForm
          key={editing.id}
          initial={{
            seriesId: editing.id,
            type: editing.type,
            title: editing.title,
            weekday: editing.weekday,
            startTime: editing.startTime,
            durationMinutes: editing.durationMinutes,
            description: editing.description,
          }}
        />
      ) : (
        <SeriesForm />
      )}
      <p><Link href="/kalender">Tilbage til kalenderen</Link></p>
    </>
  );
}
