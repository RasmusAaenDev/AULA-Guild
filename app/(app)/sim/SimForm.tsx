'use client';

import { useActionState } from 'react';
import { enqueueSimAction, type SimFormState } from './actions';
import { FightStyleToggle } from './FightStyleToggle';

/**
 * `<form action>` i stedet for onSubmit: formularen virker også uden JavaScript. Det indtastede kommer tilbage fra
 * serveren ved fejl og genindsættes via `key`; ved succes er `input` tom, og feltet nulstilles.
 */
export function SimForm() {
  const [state, action, pending] = useActionState<SimFormState, FormData>(enqueueSimAction, {});
  return (
    <form action={action} className="sim-form" data-progressive key={`${state.input ?? ''}|${state.fightStyle ?? ''}|${state.error ?? ''}|${state.notice ?? ''}`}>
      <div className="field">
        <label htmlFor="sim-input">Indsæt din SimC-tekst (fra /simc i spillet)</label>
        <textarea id="sim-input" name="input" defaultValue={state.error ? state.input ?? '' : ''} rows={12} spellCheck={false} autoComplete="off" required aria-describedby="sim-help" />
        <span id="sim-help" className="muted">
          Åbn spillet, skriv <code>/simc</code> i chatten, og kopiér hele teksten i vinduet, der kommer frem (inkl. «Gear from Bags»). Indsæt den her.
        </span>
      </div>
      <FightStyleToggle defaultValue={state.fightStyle === 'dungeonSlice' ? 'dungeonSlice' : 'patchwerk'} />
      <div className="field">
        <label><input type="checkbox" name="optimizeBags" value="on" defaultChecked={state.optimizeBags ?? true} aria-describedby="sim-bags-help" /> Find bedste gear fra mine tasker</label>
        <span id="sim-bags-help" className="muted">Genstande i taskerne læses fra «Gear from Bags»-delen af teksten.</span>
      </div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.notice && <p className="muted" role="status">{state.notice}</p>}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? 'Vent …' : 'Kør simulation'}
      </button>
    </form>
  );
}
