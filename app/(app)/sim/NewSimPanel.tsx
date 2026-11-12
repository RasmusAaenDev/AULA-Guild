'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Icon } from '@/components/icons';
import { enqueueArmorySimAction, enqueueSimAction, type SimFormState } from './actions';
import { FightStyleToggle } from './FightStyleToggle';

export type SimCharacterOption = { id: number; fullName: string; className: string };

/**
 * «Ny simulation»: to indgange (fra armory / indsat SimC-tekst) bag et segmenteret valg. Valget er to radioknapper uden
 * formular, som CSS bruger (:has) til at vise den ene formular — så det virker uden JavaScript. Begge formularer er
 * `<form action>` med useActionState: det indtastede kommer tilbage fra serveren ved fejl og genindsættes via `key`;
 * ved succes nulstilles feltet. Uden JavaScript genindlæses siden efter afsendelse, og fanen vælges da ud fra, hvilken
 * formular der har en besked, så fejlen aldrig gemmer sig bag den anden fane.
 */
export function NewSimPanel({ characters }: { characters: SimCharacterOption[] }) {
  const [armory, armoryAction, armoryPending] = useActionState<SimFormState, FormData>(enqueueArmorySimAction, {});
  const [simc, simcAction, simcPending] = useActionState<SimFormState, FormData>(enqueueSimAction, {});
  const hasCharacters = characters.length > 0;
  const simcFirst = Boolean(simc.error || simc.notice) || !hasCharacters;
  return (
    <section className="card new-sim" aria-labelledby="new-sim-h">
      <div className="new-sim-head">
        <h2 id="new-sim-h">Ny simulation</h2>
        <fieldset className="seg">
          <legend className="sr-only">Hvor skal karakteren læses fra?</legend>
          <label className="seg-option">
            <input type="radio" name="sim-source-tab" value="armory" defaultChecked={!simcFirst} />
            <Icon name="person" size={18} />
            <span>Fra armory</span>
          </label>
          <label className="seg-option">
            <input type="radio" name="sim-source-tab" value="simc" defaultChecked={simcFirst} />
            <Icon name="opslag" size={18} />
            <span>Indsæt SimC-tekst</span>
          </label>
        </fieldset>
      </div>

      <form action={armoryAction} className="sim-form" data-source="armory" data-progressive key={`a|${armory.characterId ?? ''}|${armory.fightStyle ?? ''}|${armory.error ?? ''}|${armory.notice ?? ''}`}>
        {hasCharacters ? (
          <>
            <div className="sim-form-row">
              <div className="field">
                <label htmlFor="armory-character">Karakter</label>
                <select id="armory-character" name="characterId" defaultValue={armory.characterId ?? String(characters[0].id)} required>
                  {characters.map((c) => <option key={c.id} value={c.id}>{c.fullName} ({c.className})</option>)}
                </select>
              </div>
              <FightStyleToggle defaultValue={armory.fightStyle === 'dungeonSlice' ? 'dungeonSlice' : 'patchwerk'} />
            </div>
            <p className="muted sim-help">Bruger det udstyr og de talenter, armory viser. Tager typisk et minut.</p>
            {armory.error && <p className="error" role="alert">{armory.error}</p>}
            {armory.notice && <p className="sim-notice" role="status"><Icon name="deltager" size={18} /> <span>{armory.notice}</span></p>}
            <div className="actions">
              <button type="submit" className="btn sim-submit" disabled={armoryPending}>{armoryPending ? 'Sender …' : 'Kør simulation'}</button>
            </div>
          </>
        ) : (
          <p className="muted">Du har ingen karakter endnu. <Link href="/karakter/ny">Tilføj en karakter</Link> for at simulere den fra armory, eller indsæt SimC-tekst.</p>
        )}
      </form>

      <form action={simcAction} className="sim-form" data-source="simc" data-progressive key={`s|${simc.input ?? ''}|${simc.fightStyle ?? ''}|${simc.error ?? ''}|${simc.notice ?? ''}`}>
        <div className="field">
          <label htmlFor="sim-input">SimC-tekst fra spillet</label>
          <textarea id="sim-input" name="input" defaultValue={simc.error ? simc.input ?? '' : ''} rows={8} spellCheck={false} autoComplete="off" required aria-describedby="sim-help" placeholder={'warrior="Navn"\nlevel=11\n…'} />
          <span id="sim-help" className="muted">
            Skriv <code>/simc</code> i chatten i spillet, kopiér hele teksten i vinduet (inkl. «Gear from Bags»), og indsæt den her.
          </span>
        </div>
        <div className="sim-form-row">
          <FightStyleToggle defaultValue={simc.fightStyle === 'dungeonSlice' ? 'dungeonSlice' : 'patchwerk'} />
          <div className="field sim-check">
            <label><input type="checkbox" name="optimizeBags" value="on" defaultChecked={simc.optimizeBags ?? true} aria-describedby="sim-bags-help" /> Find bedste gear fra mine tasker</label>
            <span id="sim-bags-help" className="muted">Hver genstand i «Gear from Bags» testes i stedet for det, du har på.</span>
          </div>
        </div>
        {simc.error && <p className="error" role="alert">{simc.error}</p>}
        {simc.notice && <p className="sim-notice" role="status"><Icon name="deltager" size={18} /> <span>{simc.notice}</span></p>}
        <div className="actions">
          <button type="submit" className="btn sim-submit" disabled={simcPending}>{simcPending ? 'Sender …' : 'Kør simulation'}</button>
        </div>
      </form>
    </section>
  );
}
