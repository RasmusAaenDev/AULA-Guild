'use client';

export type FightStyleChoice = 'patchwerk' | 'dungeonSlice';

/** Enten-eller-valg af kampstil (toggle). Sender de samme skjulte felter som før: patchwerk/dungeonSlice = on/off. */
export function FightStyleToggle({ value, onChange }: { value: FightStyleChoice; onChange: (v: FightStyleChoice) => void }) {
  return (
    <fieldset className="field style-toggle">
      <legend>Kampstil</legend>
      <input type="hidden" name="patchwerk" value={value === 'patchwerk' ? 'on' : 'off'} />
      <input type="hidden" name="dungeonSlice" value={value === 'dungeonSlice' ? 'on' : 'off'} />
      <div className="toggle-group">
        <label className={value === 'patchwerk' ? 'toggle-option selected' : 'toggle-option'}>
          <input type="radio" name="fightStyleChoice" value="patchwerk" checked={value === 'patchwerk'} onChange={() => onChange('patchwerk')} />
          <span>Patchwerk (enkelt mål)</span>
        </label>
        <label className={value === 'dungeonSlice' ? 'toggle-option selected' : 'toggle-option'}>
          <input type="radio" name="fightStyleChoice" value="dungeonSlice" checked={value === 'dungeonSlice'} onChange={() => onChange('dungeonSlice')} />
          <span>Dungeon Slice (flere mål)</span>
        </label>
      </div>
    </fieldset>
  );
}
