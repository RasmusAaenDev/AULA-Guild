import type { ReactNode } from 'react';
import { InitialAvatar } from '@/components/InitialAvatar';
import { buildThread, formatClock, formatMessageTime } from '@/lib/chat-ui';
import { LinkedText } from './LinkedText';

export type ThreadMessage = {
  id: string | number;
  author: string;
  content: string;
  timestamp: string;
  armoryUrl?: string | null;
  bot?: boolean;
  mine?: boolean;
  /** Fx en slet-knap; vises i beskedens øverste række. */
  actions?: ReactNode;
};

/**
 * Beskedlisten som enkelte bobler: dagsskillelinjer, initial-avatar og navn kun på den første besked i en gruppe
 * (samme afsender inden for få minutter), egne beskeder let fremhævet. Ren visning uden state.
 */
export function ChatThread({ messages, now }: { messages: ThreadMessage[]; now: Date }) {
  return (
    <>
      {buildThread(messages, now).map((item) => {
        if (item.kind === 'day') {
          return (
            <p key={`d-${item.key}`} className="chat-day">
              <time dateTime={item.key}>{item.label}</time>
            </p>
          );
        }
        const m = item.msg;
        const clock = formatClock(m.timestamp);
        const full = formatMessageTime(m.timestamp, now);
        const time = clock && (
          <time className="chat-time" dateTime={m.timestamp} title={full}>{clock}</time>
        );
        const cls = ['chat-msg', item.first ? 'is-first' : 'is-cont', m.mine ? 'is-mine' : ''].filter(Boolean).join(' ');
        return (
          <div key={m.id} className={cls}>
            <div className="chat-gutter">
              {item.first ? <InitialAvatar name={m.author} className="chat-avatar" /> : time}
            </div>
            <div className="chat-bubble">
              {item.first ? (
                <div className="chat-meta">
                  {m.armoryUrl
                    ? <strong className="chat-author"><a className="chat-link" href={m.armoryUrl} target="_blank" rel="noopener noreferrer">{m.author}</a></strong>
                    : <strong className="chat-author">{m.author}</strong>}
                  {m.mine && <span className="sr-only">(dig)</span>}
                  {m.bot && <span className="badge">bot</span>}
                  {time}
                  {m.actions && <span className="chat-actions">{m.actions}</span>}
                </div>
              ) : (
                <>
                  <span className="sr-only">{m.author}{m.mine ? ' (dig)' : ''}: </span>
                  {m.actions && <div className="chat-meta chat-meta-cont"><span className="chat-actions">{m.actions}</span></div>}
                </>
              )}
              <div className="chat-text"><LinkedText text={m.content} /></div>
            </div>
          </div>
        );
      })}
    </>
  );
}
