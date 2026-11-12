import Link from 'next/link';
import { parseSiteChannel } from '@/lib/chat-http';
import { getDb } from '@/lib/db';
import { canDeleteChannel, listChannels } from '@/lib/site-chat';
import { requireUser } from '@/lib/session';
import { NewChannelForm } from './NewChannelForm';
import { SiteChatView } from './SiteChatView';

export const dynamic = 'force-dynamic';

const EMPTY = 'Ingen kanaler endnu. Opret den første.';

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ kanal?: string | string[] }> }) {
  // Egne kanaler er åbne for alle indloggede, også gæster.
  const member = await requireUser();
  const { kanal } = await searchParams;
  const requested = typeof kanal === 'string' ? kanal : Array.isArray(kanal) ? kanal[0] : undefined;
  const channels = await listChannels(getDb());
  const id = parseSiteChannel(requested);
  // Ukendt eller manglende kanal giver den første.
  const selected = (id !== null ? channels.find((c) => c.id === id) : undefined) ?? channels[0] ?? null;

  return (
    <>
      <h1>Beskeder</h1>
      <div className="chat-layout">
        <nav className="card chat-channels" aria-label="Kanaler">
          <h2 className="chat-channels-title">Kanaler</h2>
          <ul>
            {channels.map((c) => (
              <li key={c.id}>
                <Link className="chat-chan" href={`/chat?kanal=egen-${c.id}`} aria-current={selected?.id === c.id ? 'page' : undefined}>
                  <span className="chat-chan-icon" aria-hidden="true">#</span>
                  <span className="chat-chan-name">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
          {channels.length === 0 && <p className="muted chat-channels-empty">{EMPTY}</p>}
          <NewChannelForm />
        </nav>
        {selected ? (
          <SiteChatView
            key={`egen-${selected.id}`}
            channelId={selected.id}
            name={selected.name}
            canDeleteChannel={canDeleteChannel(member, selected)}
          />
        ) : (
          <section className="card"><p className="muted">{EMPTY}</p></section>
        )}
      </div>
    </>
  );
}
