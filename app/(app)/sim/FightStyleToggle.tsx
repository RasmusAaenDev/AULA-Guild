export type FightStyleChoice = 'patchwerk' | 'dungeonSlice';

/**
 * Enten-eller-valg af kampstil (to radioknapper, samme navn). Almindelige, ukontrollerede formularfelter: virker også uden
 * JavaScript. Den valgte markeres i CSS med :has(:checked), så der ikke skal bruges tilstand i browseren.
 */
export function FightStyleToggle({ defaultValue = 'patchwerk' }: { defaultValue?: FightStyleChoice }) {
  return (
    <fieldset className="field style-toggle">
      <legend>Kampstil</legend>
      <div className="toggle-group">
        <label className="toggle-option">
          <input type="radio" name="fightStyle" value="patchwerk" defaultChecked={defaultValue === 'patchwerk'} />
          <span>Patchwerk (enkelt mål)</span>
        </label>
        <label className="toggle-option">
          <input type="radio" name="fightStyle" value="dungeonSlice" defaultChecked={defaultValue === 'dungeonSlice'} />
          <span>Dungeon Slice (flere mål)</span>
        </label>
      </div>
    </fieldset>
  );
}
