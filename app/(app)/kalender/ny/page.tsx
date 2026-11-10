import { EventForm } from '../EventForm';
import { requireMember } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function NewEventPage() {
  const member = await requireMember();
  return (
    <>
      <h1>Opret event</h1>
      <EventForm isOfficer={member.isOfficer} />
    </>
  );
}
