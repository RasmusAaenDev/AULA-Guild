'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormValues } from '@/components/useFormValues';
import { addCommentAction, type FormState } from './actions';

export function CommentForm({ postId }: { postId: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addCommentAction, {});
  const { setValues, bind } = useFormValues({ body: '' });
  const wasPending = useRef(false);
  // Ryd feltet, når en indsendelse er gennemført uden fejl.
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) setValues({ body: '' });
    wasPending.current = pending;
  }, [pending, state.error, setValues]);
  return (
    <form action={action}>
      <input type="hidden" name="postId" value={postId} />
      <div className="field">
        <label htmlFor="comment-body">Skriv en kommentar</label>
        <textarea id="comment-body" {...bind('body')} rows={3} required maxLength={2000} />
      </div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button type="submit" className="btn" disabled={pending}>{pending ? 'Sender …' : 'Kommentér'}</button>
    </form>
  );
}
