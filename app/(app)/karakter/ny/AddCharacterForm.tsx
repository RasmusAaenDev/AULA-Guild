'use client';

import { useActionState } from 'react';
import { addCharacterAction, type AddState } from '@/app/(app)/actions';

const roleOptions = [
  { value: 'tank', label: 'Tank' },
  { value: 'healer', label: 'Healer' },
  { value: 'dps', label: 'DPS' },
];

/**
 * Bruger `<form action>` i stedet for onSubmit: formularen virker også, før JavaScript er indlæst (og uden), fordi Next
 * sender den som en almindelig POST til serverhandlingen. Det indtastede sendes tilbage ved fejl og genindsættes via `key`.
 */
export function AddCharacterForm() {
  const [state, action, pending] = useActionState<AddState, FormData>(addCharacterAction, {});
  return (
    <form action={action} className="card" data-progressive key={`${state.name ?? ''}|${state.role ?? ''}|${state.error ?? ''}`}>
      <div className="field">
        <label htmlFor="name">Karakterens navn (både fornavn og efternavn)</label>
        <input id="name" name="name" defaultValue={state.name ?? ''} required maxLength={60} autoComplete="off" placeholder="fx Magi Far" />
      </div>
      <div className="field">
        <label htmlFor="role">Rolle</label>
        <select id="role" name="role" defaultValue={state.role ?? 'dps'}>
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
