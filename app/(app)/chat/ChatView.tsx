'use client';

import { useActionState, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { submitHandler, useFormValues } from '@/components/useFormValues';
import type { PublicChatResult } from '@/lib/chat-authors';
import { Icon } from '@/components/icons';
import { chatErrorMessage, chatHintMessage, isNearBottom, nextPollDelay } from '@/lib/chat-ui';
import { ChatComposer } from './ChatComposer';
import { ChatThread } from './ChatThread';
import { sendChatMessageAction, type FormState } from './actions';

function isChatResult(v: unknown): v is PublicChatResult {
  return typeof v === 'object' && v !== null && Array.isArray((v as PublicChatResult).messages);
}

export function ChatView({ channelId, canWrite, name, mySlugs }: { channelId: string; canWrite: boolean; name: string; mySlugs: string[] }) {
  const [data, setData] = useState<PublicChatResult | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [newBelow, setNewBelow] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const lastId = useRef<string | null>(null);
  const emptied = useRef(false);
  const savedTop = useRef(0);
  const refreshRef = useRef<() => void>(() => {});
  const [sendState, sendAction, sending] = useActionState<FormState, FormData>(sendChatMessageAction, {});
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
        const res = await fetch(`/api/chat?kanal=${encodeURIComponent(channelId)}`, { cache: 'no-store', signal: mine.signal });
        const body: unknown = await res.json().catch(() => null);
        if (cancelled || mine.signal.aborted) return;
        if (res.ok && isChatResult(body)) {
          failures = 0;
          setFailed(null);
          setData(body);
          setNow(new Date());
        } else {
          if (res.status === 401 || res.status === 404) {
            // Hjælper ikke at prøve igen: stop med at hente.
            halted = true;
            setFailed(res.status === 401
              ? 'Din session er udløbet. Genindlæs siden og log ind igen.'
              : 'Chatten er ikke sat op.');
          } else {
            failures++;
            setFailed('Chatten kunne ikke hentes. Prøver igen om lidt.');
          }
        }
      } catch {
        if (cancelled || mine.signal.aborted) return;
        failures++;
        setFailed('Chatten kunne ikke hentes. Prøver igen om lidt.');
      } finally {
        if (controller === mine) controller = null;
        if (!mine.signal.aborted) schedule();
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer);
        void poll();
      } else {
        clearTimeout(timer);
        controller?.abort();
        controller = null;
      }
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

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    follow.current = true;
    setNewBelow(false);
  }, []);

  // Ny sidste besked: rul med, hvis brugeren er i bunden, ellers vis knappen.
  useLayoutEffect(() => {
    const id = data?.messages.at(-1)?.id ?? null;
    if (id === null) {
      // Midlertidigt tom liste: behold lastId og husk at positionen skal genskabes.
      if (data !== null) emptied.current = true;
      return;
    }
    const wasEmptied = emptied.current;
    emptied.current = false;
    const changed = id !== lastId.current;
    const first = lastId.current === null;
    lastId.current = id;
    if (wasEmptied && !follow.current) {
      if (listRef.current) listRef.current.scrollTop = savedTop.current;
      if (changed) setNewBelow(true);
      return;
    }
    if (wasEmptied && follow.current) {
      scrollToBottom(); // listen vendte tilbage efter at have været tom, og brugeren fulgte bunden
      return;
    }
    if (!changed) return;
    if (follow.current || first) scrollToBottom();
    else setNewBelow(true);
  }, [data, scrollToBottom]);

  // Vellykket afsendelse: ryd feltet, følg bunden og hent listen igen.
  useEffect(() => {
    if (!sendState.sent) return;
    setValues({ message: '' });
    follow.current = true;
    refreshRef.current();
  }, [sendState, setValues]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el || emptied.current || !data?.messages.length) return;
    savedTop.current = el.scrollTop;
    follow.current = isNearBottom(el);
    if (follow.current) setNewBelow(false);
  };

  const error = chatErrorMessage(data?.error);
  const hint = chatHintMessage(data?.hint);

  return (
    <section className="card chat">
      <div className="chat-head">
        <div className="chat-head-text">
          <h2 className="chat-title">
            <span className="chat-title-icon" aria-hidden="true">{canWrite ? '#' : <Icon name="laas" size={16} />}</span>
            {name}
          </h2>
          <span className="chat-source">{canWrite ? 'Discord' : 'Discord · kun læsning'}</span>
        </div>
      </div>
      {failed && <p className="error" role="alert">{failed}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {hint && <p className="muted">{hint}</p>}
      {data?.stale && <p className="muted"><span className="badge">forældet</span> Viser sidst hentede beskeder.</p>}
      <div className="chat-list" ref={listRef} onScroll={onScroll} tabIndex={0} role="log" aria-live="off" aria-label={`Beskeder i ${name} fra Discord`}>
        {data === null && !failed && <p className="muted chat-empty">Henter beskeder…</p>}
        {data !== null && data.messages.length === 0 && !error && <p className="muted chat-empty">Der er ingen beskeder endnu.</p>}
        {data && (
          <ChatThread
            now={now}
            messages={data.messages.map((m) => ({ ...m, mine: m.characterSlug !== null && mySlugs.includes(m.characterSlug) }))}
          />
        )}
      </div>
      {newBelow && (
        <button type="button" className="btn chat-new" onClick={scrollToBottom}>Nye beskeder ↓</button>
      )}
      {canWrite ? (
      <ChatComposer channelId={channelId} bind={bind('message')} error={sendState.error} disabled={sending || values.message.trim() === ''} onSubmit={submitHandler(sendAction)} />
      ) : (
        <p className="muted chat-readonly"><Icon name="laas" size={16} /> Du kan kun læse i denne kanal.</p>
      )}
    </section>
  );
}
