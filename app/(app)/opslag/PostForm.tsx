'use client';

import { useActionState } from 'react';
import { createPostAction, type FormState } from './actions';

export function PostForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createPostAction, {});
  return (
    <form action={action} className="card">
      <div className="field">
        <label htmlFor="title">Titel</label>
        <input id="title" name="title" required maxLength={120} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="body">Tekst</label>
        <textarea id="body" name="body" rows={8} required maxLength={5000} />
      </div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button type="submit" className="btn" disabled={pending}>{pending ? 'Gemmer …' : 'Skriv opslag'}</button>
    </form>
  );
}
