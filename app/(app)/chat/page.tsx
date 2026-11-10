import Link from 'next/link';
import { chatConfig } from '@/lib/chat-config';
import { parseSiteChannel } from '@/lib/chat-http';
import { pickChannel } from '@/lib/chat-ui';
import { getDb } from '@/lib/db';
import { canDeleteChannel, listChannels } from '@/lib/site-chat';
import { getChat } from '@/lib/services';
import { requireMember } from '@/lib/session';
import { ChatView } from './ChatView';
import { NewChannelForm } from './NewChannelForm';
import { SiteChatView } from './SiteChatView';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ kanal?: string | string[] }> }) {
  const member = await requireMember();
  const cfg = chatConfig();
  const chat = cfg ? getChat() : null;
  const { kanal } = await searchParams;
  const requested = typeof kanal === 'string' ? kanal : Array.isArray(kanal) ? kanal[0] : undefined;
  const own = await listChannels(getDb());
  const list = chat ? await chat.listChannels() : null;

  const ownId = parseSiteChannel(requested);
  let selectedOwn = ownId !== null ? own.find((c) => c.id === ownId) ?? null : null;
  const selected = !selectedOwn && list && cfg ? pickChannel(list.channels, requested, cfg.channelId) : null;
  // Uden Discord (eller uden synlige Discord-kanaler) vises den første egne kanal.
  if (!selectedOwn && !selected) selectedOwn = own[0] ?? null;

  return (
    <>
      <h1>Beskeder</h1>
      {list?.error && <section className="card"><p className="error" role="alert">Discord-kanalerne kunne ikke hentes lige nu. Prøv igen om lidt.</p></section>}
      <div className="chat-layout">
        <nav className="card chat-channels" aria-label="Kanaler">
          {list && !list.error && (
            <>
              <h2 className="chat-channels-title">Discord</h2>
              <ul>
                {list.channels.map((c) => (
                  <li key={c.id}>
                    <Link href={`/chat?kanal=${c.id}`} aria-current={selected?.id === c.id ? 'page' : undefined}>
                      <span># {c.name}</span>
                      {!c.canWrite && <span className="badge">kun læsning</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h2 className="chat-channels-title">Egne kanaler</h2>
          <ul>
            {own.map((c) => (
              <li key={c.id}>
                <Link href={`/chat?kanal=egen-${c.id}`} aria-current={selectedOwn?.id === c.id ? 'page' : undefined}>
                  <span># {c.name}</span>
                  <span className="badge">kun her</span>
                </Link>
              </li>
            ))}
          </ul>
          {own.length === 0 && <p className="muted chat-channels-empty">Ingen egne kanaler endnu.</p>}
          <NewChannelForm />
        </nav>
        {selectedOwn ? (
          <SiteChatView
            key={`egen-${selectedOwn.id}`}
            channelId={selectedOwn.id}
            name={selectedOwn.name}
            canDeleteChannel={canDeleteChannel(member, selectedOwn)}
          />
        ) : selected ? (
          <ChatView key={selected.id} channelId={selected.id} canWrite={selected.canWrite} />
        ) : (
          <section className="card"><p className="muted">Vælg eller opret en kanal for at begynde.</p></section>
        )}
      </div>
    </>
  );
}
