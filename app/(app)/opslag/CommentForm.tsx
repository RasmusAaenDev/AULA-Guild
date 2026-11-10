'use client';

import { useActionState, useEffect, useRef } from 'react';
import { addCommentAction, type FormState } from './actions';

export function CommentForm({ postId }: { postId: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addCommentAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  // Ryd feltet, når en indsendelse er gennemført uden fejl.
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) formRef.current?.reset();
    wasPending.current = pending;
  }, [pending, state.error]);
  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="postId" value={postId} />
      <div className="field">
        <label htmlFor="comment-body">Skriv en kommentar</label>
        <textarea id="comment-body" name="body" rows={3} required maxLength={2000} />
      </div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button type="submit" className="btn" disabled={pending}>{pending ? 'Sender …' : 'Kommentér'}</button>
    </form>
  );
}
