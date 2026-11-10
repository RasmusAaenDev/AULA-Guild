import Link from 'next/link';
import { setActiveAction } from '@/app/(app)/actions';
import { classKey, sortForSwitcher, switcherLabel } from '@/lib/character-switcher';
import { initials } from '@/lib/names';
import type { MyCharacter } from '@/lib/characters';
import { Icon } from './icons';

/**
 * Alle brugerens karakterer som runde avatarer i topbjælken (som AULA viser børn). Den primære har et flueben
 * og aria-current; et klik på en anden submitter setActiveAction (ejerskab tjekkes server-side i modulet).
 */
export function CharacterSwitcher({ characters, activeId }: { characters: MyCharacter[]; activeId: number | null }) {
  if (characters.length === 0) {
    return (
      <div className="topbar-chars">
        <Link href="/karakter/ny" className="cs-add">Tilføj karakter</Link>
      </div>
    );
  }
  return (
    <nav className="topbar-chars" aria-label="Dine karakterer">
      <ul className="cs-list">
        {sortForSwitcher(characters).map((c) => {
          const primary = c.id === activeId;
          const label = switcherLabel(c.fullName, primary);
          const cls = `cs-avatar cs-cls-${classKey(c.className)}`;
          const inner = (
            <>
              <span aria-hidden="true">{initials(c.fullName)}</span>
              {primary && (
                <span className="cs-check" aria-hidden="true">
                  <Icon name="deltager" size={12} />
                </span>
              )}
            </>
          );
          return (
            <li key={c.id}>
              {primary ? (
                <button type="button" className={cls} title={label} aria-label={label} aria-current="true">{inner}</button>
              ) : (
                <form action={setActiveAction}>
                  <input type="hidden" name="characterId" value={c.id} />
                  <button type="submit" className={cls} title={label} aria-label={label}>{inner}</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
