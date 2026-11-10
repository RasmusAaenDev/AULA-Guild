'use client';

import { useActionState } from 'react';
import { submitHandler, useFormValues } from '@/components/useFormValues';
import type { FormState } from './actions';
import { createSiteChannelAction } from './site-actions';

export function NewChannelForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createSiteChannelAction, {});
  const { values, bind } = useFormValues({ name: '' });
  return (
    <details className="chat-new-channel">
      <summary>Ny kanal</summary>
      <form onSubmit={submitHandler(action)}>
        <div className="field">
          <label htmlFor="new-channel-name">Navn på kanalen</label>
          <input id="new-channel-name" {...bind('name')} maxLength={40} required autoComplete="off" />
          <span className="muted">2–30 tegn: bogstaver, tal, mellemrum, - og _. Kanalen er åben for hele guilden.</span>
        </div>
        {state.error && <p className="error" role="alert">{state.error}</p>}
        <button type="submit" className="btn" disabled={pending || values.name.trim() === ''}>Opret kanal</button>
      </form>
    </details>
  );
}
