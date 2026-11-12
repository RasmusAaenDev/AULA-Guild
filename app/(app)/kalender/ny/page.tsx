import { EventForm } from '../EventForm';
import { requireGuildMember } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function NewEventPage() {
  const member = await requireGuildMember();
  return (
    <>
      <h1>Opret event</h1>
      <EventForm isOfficer={member.isOfficer} />
    </>
  );
}
