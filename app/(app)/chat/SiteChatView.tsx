'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { ConfirmForm } from '@/components/ConfirmForm';
import { submitHandler, useFormValues } from '@/components/useFormValues';
import { isNearBottom, nextPollDelay } from '@/lib/chat-ui';
import { ChatComposer } from './ChatComposer';
import { ChatThread } from './ChatThread';
import { deleteSiteChannelAction, deleteSiteMessageAction, sendSiteMessageAction } from './site-actions';
import type { FormState } from './actions';

type SiteMsg = { id: number; author: string; content: string; timestamp: string; canDelete: boolean; mine?: boolean };

function isMessages(v: unknown): v is { messages: SiteMsg[] } {
  return typeof v === 'object' && v !== null && Array.isArray((v as { messages?: unknown }).messages);
}

/** Egen kanal (kun på websitet). Rendres med key={kanal}, så intet blandes mellem kanaler. */
export function SiteChatView({ channelId, name, canDeleteChannel }: { channelId: number; name: string; canDeleteChannel: boolean }) {
  const [messages, setMessages] = useState<SiteMsg[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const listRef = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const refreshRef = useRef<() => void>(() => {});
  const [sendState, sendAction, sending] = useActionState<FormState, FormData>(sendSiteMessageAction, {});
  const { values, setValues, bind } = useFormValues({ message: '' });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let failures = 0;
    let halted = false;
    const schedule = () => {
      clearTimeout(timer);
      if (cancelled || halted || document.visibilityState !== 'visible') return;
      timer = setTimeout(poll, nextPollDelay(failures));
    };
    async function poll() {
      if (cancelled || halted || controller || document.visibilityState !== 'visible') return;
      const mine = new AbortController();
      controller = mine;
      try {
        const res = await fetch(`/api/chat?kanal=egen-${channelId}`, { cache: 'no-store', signal: mine.signal });
        const body: unknown = await res.json().catch(() => null);
        if (cancelled || mine.signal.aborted) return;
        if (res.ok && isMessages(body)) {
          failures = 0;
          setFailed(null);
          setMessages(body.messages);
          setNow(new Date());
        } else if (res.status === 401 || res.status === 404) {
          halted = true;
          setFailed(res.status === 401 ? 'Din session er udløbet. Genindlæs siden og log ind igen.' : 'Kanalen findes ikke længere.');
        } else {
          failures++;
          setFailed('Beskederne kunne ikke hentes. Prøver igen om lidt.');
        }
      } catch {
        if (cancelled || mine.signal.aborted) return;
        failures++;
        setFailed('Beskederne kunne ikke hentes. Prøver igen om lidt.');
      } finally {
        if (controller === mine) controller = null;
        if (!mine.signal.aborted) schedule();
      }
    }
    const onVisibility = () => {
      clearTimeout(timer);
      if (document.visibilityState === 'visible') void poll();
      else { controller?.abort(); controller = null; }
    };
    refreshRef.current = () => {
      if (cancelled || halted) return;
      clearTimeout(timer);
      controller?.abort();
      controller = null;
      void poll();
    };
    document.addEventListener('visibilitychange', onVisibility);
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [channelId]);

  const lastId = messages?.at(-1)?.id ?? null;
  useEffect(() => {
    const el = listRef.current;
    if (el && follow.current) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  useEffect(() => {
    if (!sendState.sent) return;
    setValues({ message: '' });
    follow.current = true;
    refreshRef.current();
  }, [sendState, setValues]);

  return (
    <section className="card chat">
      <div className="chat-head">
        <div className="chat-head-text">
          <h2 className="chat-title">
            <span className="chat-title-icon" aria-hidden="true">#</span>
            {name}
          </h2>
          <span className="chat-source">Kun her på siden</span>
        </div>
        {canDeleteChannel && (
          <ConfirmForm action={deleteSiteChannelAction} fields={{ channelId }} label="Slet kanal" confirmText={`Slet kanalen «${name}» og alle dens beskeder?`} />
        )}
      </div>
      {failed && <p className="error" role="alert">{failed}</p>}
      <div
        className="chat-list" ref={listRef} tabIndex={0} role="log" aria-live="off" aria-label={`Beskeder i ${name}`}
        onScroll={() => { if (listRef.current) follow.current = isNearBottom(listRef.current); }}
      >
        {messages === null && !failed && <p className="muted chat-empty">Henter beskeder…</p>}
        {messages !== null && messages.length === 0 && <p className="muted chat-empty">Der er ingen beskeder endnu.</p>}
        {messages && (
          <ChatThread
            now={now}
            messages={messages.map((m) => ({
              ...m,
              actions: m.canDelete
                ? <ConfirmForm action={deleteSiteMessageAction} fields={{ messageId: m.id }} label="Slet" confirmText="Slet denne besked?" />
                : undefined,
            }))}
          />
        )}
      </div>
      <ChatComposer channelId={channelId} bind={bind('message')} error={sendState.error} disabled={sending || values.message.trim() === ''} onSubmit={submitHandler(sendAction)} />
    </section>
  );
}
