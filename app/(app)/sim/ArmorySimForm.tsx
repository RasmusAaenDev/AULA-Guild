'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useHydrated } from '@/components/useHydrated';
import { submitHandler, useFormValues } from '@/components/useFormValues';
import { FightStyleToggle, type FightStyleChoice } from './FightStyleToggle';
import type { FormState } from '../chat/actions';
import { enqueueArmorySimAction } from './actions';

export function ArmorySimForm({ characters }: { characters: { id: number; fullName: string; className: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(enqueueArmorySimAction, {});
  const { values, setValues, bind } = useFormValues<{ characterId: string; style: FightStyleChoice }>({
    characterId: characters[0] ? String(characters[0].id) : '', style: 'patchwerk',
  });
  const hydrated = useHydrated();
  if (characters.length === 0) {
    return <p className="muted">Du har ingen karakter endnu. <Link href="/karakter/ny">Tilføj en karakter</Link> for at simulere den fra armory.</p>;
  }
  return (
    <form onSubmit={submitHandler(action)} className="sim-form">
      <div className="field">
        <label htmlFor="armory-character">Karakter</label>
        <select id="armory-character" {...bind('characterId')} required>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.fullName} ({c.className})</option>)}
        </select>
      </div>
      <FightStyleToggle value={values.style} onChange={(style) => setValues((v) => ({ ...v, style }))} />
      <p className="muted">Bruger det udstyr, armory viser. Talenter kan simulatoren endnu ikke læse fra armory, så simulationen kører uden talenter. Genstande i tasker kendes ikke her — brug SimC-teksten fra spillet, hvis du vil have gear-optimering.</p>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.notice && <p className="muted" role="status">{state.notice}</p>}
      <button type="submit" className="btn" disabled={!hydrated || pending}>{!hydrated ? 'Indlæser …' : pending ? 'Vent …' : 'Kør simulation'}</button>
    </form>
  );
}
