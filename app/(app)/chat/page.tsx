import Link from 'next/link';
import { chatConfig } from '@/lib/chat-config';
import { pickChannel } from '@/lib/chat-ui';
import { getChat } from '@/lib/services';
import { requireMember } from '@/lib/session';
import { ChatView } from './ChatView';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ kanal?: string | string[] }> }) {
  await requireMember();
  const cfg = chatConfig();
  const chat = getChat();
  if (!cfg || !chat) {
    return (
      <>
        <h1>Beskeder</h1>
        <section className="card"><p className="muted">Chatten er ikke sat op.</p></section>
      </>
    );
  }
  const { kanal } = await searchParams;
  const list = await chat.listChannels();
  const selected = pickChannel(list.channels, kanal, cfg.channelId);
  return (
    <>
      <h1>Beskeder</h1>
      {list.error && <section className="card"><p className="error" role="alert">Kanalerne kunne ikke hentes lige nu. Prøv igen om lidt.</p></section>}
      {!list.error && !selected && <section className="card"><p className="muted">Der er ingen offentlige kanaler at vise.</p></section>}
      {selected && (
        <div className="chat-layout">
          <nav className="card chat-channels" aria-label="Kanaler">
            <ul>
              {list.channels.map((c) => (
                <li key={c.id}>
                  <Link href={`/chat?kanal=${c.id}`} aria-current={c.id === selected.id ? 'page' : undefined}>
                    <span># {c.name}</span>
                    {!c.canWrite && <span className="badge">kun læsning</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ChatView key={selected.id} channelId={selected.id} canWrite={selected.canWrite} />
        </div>
      )}
    </>
  );
}
