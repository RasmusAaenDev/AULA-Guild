import { isChatConfigured } from '@/lib/services';
import { requireMember } from '@/lib/session';
import { ChatView } from './ChatView';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  await requireMember();
  return (
    <>
      <h1>Beskeder</h1>
      {isChatConfigured() ? (
        <ChatView />
      ) : (
        <section className="card"><p className="muted">Chatten er ikke sat op.</p></section>
      )}
    </>
  );
}
