'use client';

import { useActionState, useEffect } from 'react';
import { useHydrated } from '@/components/useHydrated';
import { submitHandler, useFormValues } from '@/components/useFormValues';
import { FightStyleToggle, type FightStyleChoice } from './FightStyleToggle';
import type { FormState } from '../chat/actions';
import { enqueueSimAction } from './actions';

type OnOff = 'on' | 'off';
const flip = (v: OnOff): OnOff => (v === 'on' ? 'off' : 'on');

export function SimForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(enqueueSimAction, {});
  // Afkrydsningsfelter er ikke strengfelter: deres tilstand ligger som 'on'/'off' i useFormValues og sendes via skjulte felter.
  const { values, setValues } = useFormValues<{ input: string; style: FightStyleChoice; optimizeBags: OnOff }>({
    input: '', style: 'patchwerk', optimizeBags: 'on',
  });
  useEffect(() => {
    if (state.sent) setValues((v) => ({ ...v, input: '' }));
  }, [state, setValues]);
  const hydrated = useHydrated();
  const toggleBags = () => setValues((v) => ({ ...v, optimizeBags: flip(v.optimizeBags) }));
  return (
    <form onSubmit={submitHandler(action)} className="sim-form">
      <div className="field">
        <label htmlFor="sim-input">Indsæt din SimC-tekst (fra /simc i spillet)</label>
        <textarea id="sim-input" name="input" value={values.input} onChange={(e) => setValues((v) => ({ ...v, input: e.target.value }))} rows={12} spellCheck={false} autoComplete="off" required aria-describedby="sim-help" />
        <span id="sim-help" className="muted">
          Åbn spillet, skriv <code>/simc</code> i chatten, og kopiér hele teksten i vinduet, der kommer frem (inkl. «Gear from Bags»). Indsæt den her.
        </span>
      </div>
      <FightStyleToggle value={values.style} onChange={(style) => setValues((v) => ({ ...v, style }))} />
      <input type="hidden" name="optimizeBags" value={values.optimizeBags} />
      <div className="field">
        <label><input type="checkbox" checked={values.optimizeBags === 'on'} onChange={toggleBags} aria-describedby="sim-bags-help" /> Find bedste gear fra mine tasker</label>
        <span id="sim-bags-help" className="muted">Genstande i taskerne læses fra «Gear from Bags»-delen af teksten.</span>
      </div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.notice && <p className="muted" role="status">{state.notice}</p>}
      <button type="submit" className="btn" disabled={!hydrated || pending || values.input.trim() === ''}>
        {!hydrated ? 'Indlæser …' : pending ? 'Vent …' : 'Kør simulation'}
      </button>
    </form>
  );
}
