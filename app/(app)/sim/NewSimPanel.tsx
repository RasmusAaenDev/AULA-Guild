'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icons';
import { nextFieldValue } from '@/lib/sims-ui';
import { enqueueArmorySimAction, enqueueSimAction, type SimFormState } from './actions';
import { FightStyleToggle } from './FightStyleToggle';

export type SimCharacterOption = { id: number; fullName: string; className: string };

/**
 * Karakterfeltet: fritekst (enhver karakter på WoW Forever), udfyldt med den primære karakter som standard. Skifter
 * brugeren primær (siden re-renderes med ny `defaultName`), følger feltet med – men kun hvis det stadig står på den
 * forrige standard eller er tomt (se nextFieldValue). Uden JavaScript er det blot server-renderet med standardværdien.
 */
function useFollowDefault(initial: string, defaultName: string): [string, (v: string) => void] {
  const [value, setValue] = useState(initial);
  const prev = useRef(defaultName);
  useEffect(() => {
    if (prev.current !== defaultName) {
      setValue((v) => nextFieldValue(v, prev.current, defaultName));
      prev.current = defaultName;
    }
  }, [defaultName]);
  return [value, setValue];
}

function CharacterField({ state, defaultName, suggestions }: { state: SimFormState; defaultName: string; suggestions: string[] }) {
  const [value, setValue] = useFollowDefault(state.error ? state.characterName ?? defaultName : defaultName, defaultName);
  return (
    <div className="field">
      <label htmlFor="armory-character">Karakter (fornavn og efternavn)</label>
      <input
        id="armory-character" name="characterName" type="text" value={value} onChange={(e) => setValue(e.target.value)}
        required maxLength={60} autoComplete="off" placeholder="fx Magi Far" list="armory-character-list" aria-describedby="armory-help"
      />
      <datalist id="armory-character-list">
        {suggestions.map((s) => <option key={s} value={s} />)}
      </datalist>
    </div>
  );
}

/**
 * «+ Ny simulation»: et sammenfoldeligt panel (native <details>, virker uden JavaScript) med to indgange (fra armory /
 * indsat SimC-tekst) bag et segmenteret valg. Valget er to radioknapper uden formular, som CSS bruger (:has) til at vise
 * den ene formular. Begge formularer er `<form action>` med useActionState: det indtastede kommer tilbage fra serveren
 * ved fejl og genindsættes via `key`; ved succes nulstilles feltet.
 *
 * Panelet er lukket som standard og åbnes kun (a) når brugeren ingen simulationer har (`defaultOpen`), og (b) når en
 * afsendelse kom tilbage med en fejl, så beskeden er synlig – også uden JavaScript, hvor siden genindlæses og fanen
 * vælges ud fra, hvilken formular der har beskeden. Efter en vellykket afsendelse lukkes panelet (med JavaScript via
 * effekten; uden JavaScript fordi den genindlæste side ikke har en fejl), og det nye kort står øverst i listen.
 * `streamer` (server-renderet) viser live-status i panelets hoved, mens noget kører.
 */
export function NewSimPanel({ characters, activeCharacterName, defaultOpen, streamer }: { characters: SimCharacterOption[]; activeCharacterName: string | null; defaultOpen: boolean; streamer: ReactNode }) {
  const [armory, armoryAction, armoryPending] = useActionState<SimFormState, FormData>(enqueueArmorySimAction, {});
  const [simc, simcAction, simcPending] = useActionState<SimFormState, FormData>(enqueueSimAction, {});
  const details = useRef<HTMLDetailsElement>(null);
  const simcFirst = Boolean(simc.error || simc.notice);
  const hasError = Boolean(armory.error || simc.error);
  const notice = armory.sent ? armory.notice : simc.sent ? simc.notice : undefined;
  useEffect(() => {
    if ((armory.sent || simc.sent) && details.current) details.current.open = false;
  }, [armory, simc]);
  return (
    <div className={streamer ? 'card new-sim-wrap has-streamer' : 'card new-sim-wrap'}>
      <details ref={details} className="new-sim" open={defaultOpen || hasError}>
        <summary className="new-sim-summary">
          <span className="new-sim-plus" aria-hidden="true"><Icon name="opret" size={20} /></span>
          <span className="new-sim-label">Ny simulation</span>
          <span className="new-sim-chevron" aria-hidden="true"><Icon name="pil-ned" size={20} /></span>
        </summary>
        <div className="new-sim-body">
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

          <form action={armoryAction} className="sim-form" data-source="armory" data-progressive key={`a|${armory.characterName ?? ''}|${armory.fightStyle ?? ''}|${armory.error ?? ''}|${armory.notice ?? ''}`}>
            <div className="sim-form-row">
              <CharacterField state={armory} defaultName={activeCharacterName ?? ''} suggestions={characters.map((c) => c.fullName)} />
              <FightStyleToggle defaultValue={armory.fightStyle === 'dungeonSlice' ? 'dungeonSlice' : 'patchwerk'} />
            </div>
            <p id="armory-help" className="muted sim-help">
              Enhver karakter på WoW Forever, også andres. Bruger det udstyr og de talenter, armory viser. Tager typisk et minut.
              {characters.length === 0 && <> <Link href="/karakter/ny">Tilføj en karakter</Link>, så står den her som forslag.</>}
            </p>
            {armory.error && <p className="error" role="alert">{armory.error}</p>}
            <div className="actions">
              <button type="submit" className="btn sim-submit" disabled={armoryPending}>{armoryPending ? 'Sender …' : 'Kør simulation'}</button>
            </div>
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
            <div className="actions">
              <button type="submit" className="btn sim-submit" disabled={simcPending}>{simcPending ? 'Sender …' : 'Kør simulation'}</button>
            </div>
          </form>
        </div>
      </details>
      {streamer}
      {notice && <p className="sim-notice" role="status"><Icon name="deltager" size={18} /> <span>{notice}</span></p>}
    </div>
  );
}
