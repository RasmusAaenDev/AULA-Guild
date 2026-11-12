import Link from 'next/link';
import { Icon } from '@/components/icons';
import { ownCharacterSlugs } from '@/lib/chat-authors';
import { chatConfig } from '@/lib/chat-config';
import { parseSiteChannel } from '@/lib/chat-http';
import { pickChannel } from '@/lib/chat-ui';
import { getDb } from '@/lib/db';
import { canDeleteChannel, listChannels } from '@/lib/site-chat';
import { getChat } from '@/lib/services';
import { requireUser } from '@/lib/session';
import { ChatView } from './ChatView';
import { NewChannelForm } from './NewChannelForm';
import { SiteChatView } from './SiteChatView';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ kanal?: string | string[] }> }) {
  const member = await requireUser();
  const cfg = chatConfig();
  // Discord-kanalerne vises kun for guildens medlemmer; egne kanaler for alle indloggede.
  const chat = cfg && member.isGuildMember ? getChat() : null;
  const { kanal } = await searchParams;
  const requested = typeof kanal === 'string' ? kanal : Array.isArray(kanal) ? kanal[0] : undefined;
  const own = await listChannels(getDb());
  const list = chat ? await chat.listChannels() : null;
  const mySlugs = list ? await ownCharacterSlugs(getDb(), member.userId) : [];

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
                    <Link className="chat-chan" href={`/chat?kanal=${c.id}`} aria-current={selected?.id === c.id ? 'page' : undefined} title={c.canWrite ? undefined : 'Kun læsning'}>
                      <span className="chat-chan-icon" aria-hidden="true">{c.canWrite ? '#' : <Icon name="laas" size={14} />}</span>
                      <span className="chat-chan-name">{c.name}</span>
                      {!c.canWrite && <span className="sr-only">(kun læsning)</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h2 className="chat-channels-title">Egne kanaler <span className="chat-channels-sub">kun her på siden</span></h2>
          <ul>
            {own.map((c) => (
              <li key={c.id}>
                <Link className="chat-chan" href={`/chat?kanal=egen-${c.id}`} aria-current={selectedOwn?.id === c.id ? 'page' : undefined}>
                  <span className="chat-chan-icon" aria-hidden="true">#</span>
                  <span className="chat-chan-name">{c.name}</span>
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
          <ChatView key={selected.id} channelId={selected.id} canWrite={selected.canWrite} name={selected.name} mySlugs={mySlugs} />
        ) : (
          <section className="card"><p className="muted">Vælg eller opret en kanal for at begynde.</p></section>
        )}
      </div>
    </>
  );
}
