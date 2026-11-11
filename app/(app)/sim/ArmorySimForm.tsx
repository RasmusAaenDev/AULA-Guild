'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { submitHandler, useFormValues } from '@/components/useFormValues';
import type { FormState } from '../chat/actions';
import { enqueueArmorySimAction } from './actions';

type OnOff = 'on' | 'off';
const flip = (v: OnOff): OnOff => (v === 'on' ? 'off' : 'on');

export function ArmorySimForm({ characters }: { characters: { id: number; fullName: string; className: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(enqueueArmorySimAction, {});
  const { values, setValues, bind } = useFormValues<{ characterId: string; patchwerk: OnOff; dungeonSlice: OnOff }>({
    characterId: characters[0] ? String(characters[0].id) : '', patchwerk: 'on', dungeonSlice: 'on',
  });
  if (characters.length === 0) {
    return <p className="muted">Du har ingen karakter endnu. <Link href="/karakter/ny">Tilføj en karakter</Link> for at simulere den fra armory.</p>;
  }
  const noStyle = values.patchwerk === 'off' && values.dungeonSlice === 'off';
  const toggle = (k: 'patchwerk' | 'dungeonSlice') => () => setValues((v) => ({ ...v, [k]: flip(v[k]) }));
  return (
    <form onSubmit={submitHandler(action)} className="sim-form">
      <div className="field">
        <label htmlFor="armory-character">Karakter</label>
        <select id="armory-character" {...bind('characterId')} required>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.fullName} ({c.className})</option>)}
        </select>
      </div>
      <fieldset className="field">
        <legend>Kampstil</legend>
        <input type="hidden" name="patchwerk" value={values.patchwerk} />
        <input type="hidden" name="dungeonSlice" value={values.dungeonSlice} />
        <label><input type="checkbox" checked={values.patchwerk === 'on'} onChange={toggle('patchwerk')} /> Patchwerk (enkelt mål)</label>
        <label><input type="checkbox" checked={values.dungeonSlice === 'on'} onChange={toggle('dungeonSlice')} /> Dungeon Slice (flere mål)</label>
        {noStyle && <span className="error" role="alert">Vælg mindst én kampstil.</span>}
      </fieldset>
      <p className="muted">Bruger det udstyr og de talenter, armory viser. Genstande i tasker kendes ikke her — brug SimC-teksten fra spillet, hvis du vil have gear-optimering.</p>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.notice && <p className="muted" role="status">{state.notice}</p>}
      <button type="submit" className="btn" disabled={pending || noStyle}>{pending ? 'Vent …' : 'Kør simulation'}</button>
    </form>
  );
}
