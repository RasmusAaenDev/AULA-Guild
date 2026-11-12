import { notFound, redirect } from 'next/navigation';
import { EventForm } from '../../EventForm';
import { getDb } from '@/lib/db';
import { getEvent } from '@/lib/events';
import { parseId } from '@/lib/parse';
import { requireGuildMember } from '@/lib/session';
import { utcToCopenhagen } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const member = await requireGuildMember();
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) notFound();
  const event = await getEvent(getDb(), id);
  if (!event) notFound();
  const canManage = member.isOfficer || (event.type === 'aften' && event.createdBy === member.userId);
  if (!canManage || event.cancelled) redirect(`/kalender/${event.id}`);
  const local = utcToCopenhagen(event.startsAt);
  return (
    <>
      <h1>Redigér event</h1>
      <EventForm
        isOfficer={member.isOfficer}
        initial={{
          eventId: event.id,
          type: event.type,
          title: event.title,
          date: local.date,
          time: local.time,
          durationMinutes: event.durationMinutes,
          description: event.description,
        }}
      />
    </>
  );
}
