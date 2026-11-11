import Link from 'next/link';
import { LinkedText } from '@/app/(app)/chat/LinkedText';
import { Icon } from '@/components/icons';
import { chatItemHref, type ChatItem } from '@/lib/overview-chat';
import { formatAbsolute, formatRelativeDay } from '@/lib/posts-ui';

/** Chatbesked i Overblik: ligner et opslag, men med chat-ikon og kant i accentfarven. Al tekst er rene React-noder. */
export function ChatItemCard({ item, now }: { item: ChatItem; now: Date }) {
  return (
    <article className="card post-card chat-item-card">
      <div className="post-head">
        <p className="post-meta">
          <time className="muted" dateTime={item.at.toISOString()} title={formatAbsolute(item.at)}>
            {formatRelativeDay(item.at, now)}
          </time>
        </p>
      </div>
      <h3 className="chat-item-title">
        <Icon name="chat" size={22} />
        <span>
          {item.armoryUrl ? (
            <a href={item.armoryUrl} target="_blank" rel="noopener noreferrer" title="Åbn i WoW-armory">{item.author}</a>
          ) : (
            item.author
          )}{' '}
          i #{item.channelName}
        </span>
      </h3>
      <p className="excerpt chat-item-text"><LinkedText text={item.content} /></p>
      <p><Link href={chatItemHref(item)}>Åbn i Beskeder</Link></p>
    </article>
  );
}
