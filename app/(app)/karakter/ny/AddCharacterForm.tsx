'use client';

import { useActionState } from 'react';
import { addCharacterAction, type AddState } from '@/app/(app)/actions';
import { submitHandler, useFormValues } from '@/components/useFormValues';

const roleOptions = [
  { value: 'tank', label: 'Tank' },
  { value: 'healer', label: 'Healer' },
  { value: 'dps', label: 'DPS' },
];

export function AddCharacterForm() {
  const [state, action, pending] = useActionState<AddState, FormData>(addCharacterAction, {});
  const { bind } = useFormValues({ name: '', role: 'dps' });
  return (
    <form onSubmit={submitHandler(action)} className="card">
      <div className="field">
        <label htmlFor="name">Karakterens navn (både fornavn og efternavn)</label>
        <input id="name" {...bind('name')} required maxLength={60} autoComplete="off" placeholder="fx Magi Far" />
      </div>
      <div className="field">
        <label htmlFor="role">Rolle</label>
        <select id="role" {...bind('role')}>
          {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? 'Slår op i armory …' : 'Tilføj karakter'}
      </button>
    </form>
  );
}
