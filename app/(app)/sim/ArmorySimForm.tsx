'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { enqueueArmorySimAction, type SimFormState } from './actions';
import { FightStyleToggle } from './FightStyleToggle';

/** `<form action>` (virker uden JavaScript); valget genindsættes fra serveren ved fejl, se SimForm. */
export function ArmorySimForm({ characters }: { characters: { id: number; fullName: string; className: string }[] }) {
  const [state, action, pending] = useActionState<SimFormState, FormData>(enqueueArmorySimAction, {});
  if (characters.length === 0) {
    return <p className="muted">Du har ingen karakter endnu. <Link href="/karakter/ny">Tilføj en karakter</Link> for at simulere den fra armory.</p>;
  }
  return (
    <form action={action} className="sim-form" data-progressive key={`${state.characterId ?? ''}|${state.fightStyle ?? ''}|${state.error ?? ''}|${state.notice ?? ''}`}>
      <div className="field">
        <label htmlFor="armory-character">Karakter</label>
        <select id="armory-character" name="characterId" defaultValue={state.characterId ?? String(characters[0].id)} required>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.fullName} ({c.className})</option>)}
        </select>
      </div>
      <FightStyleToggle defaultValue={state.fightStyle === 'dungeonSlice' ? 'dungeonSlice' : 'patchwerk'} />
      <p className="muted">Bruger det udstyr og de talenter, armory viser.</p>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.notice && <p className="muted" role="status">{state.notice}</p>}
      <button type="submit" className="btn" disabled={pending}>{pending ? 'Vent …' : 'Kør simulation'}</button>
    </form>
  );
}
