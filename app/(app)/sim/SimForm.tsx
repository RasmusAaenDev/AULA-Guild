'use client';

import { useActionState, useEffect } from 'react';
import { submitHandler, useFormValues } from '@/components/useFormValues';
import type { FormState } from '../chat/actions';
import { enqueueSimAction } from './actions';

export function SimForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(enqueueSimAction, {});
  const { values, setValues, bind } = useFormValues({ input: '' });
  useEffect(() => {
    if (state.sent) setValues({ input: '' });
  }, [state, setValues]);
  return (
    <form onSubmit={submitHandler(action)} className="sim-form">
      <div className="field">
        <label htmlFor="sim-input">Indsæt din SimC-tekst (fra /simc i spillet)</label>
        <textarea id="sim-input" {...bind('input')} rows={12} spellCheck={false} autoComplete="off" required aria-describedby="sim-help" />
        <span id="sim-help" className="muted">
          Åbn spillet, skriv <code>/simc</code> i chatten, og kopiér hele teksten i vinduet, der kommer frem. Indsæt den her.
        </span>
      </div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button type="submit" className="btn" disabled={pending || values.input.trim() === ''}>
        {pending ? 'Vent …' : 'Kør simulation'}
      </button>
    </form>
  );
}
