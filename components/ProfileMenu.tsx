import Link from 'next/link';
import { DetailsMenu } from './DetailsMenu';
import { roles, type Role } from '@/lib/db/schema';
import { roleLabel } from '@/lib/messages';
import type { MyCharacter } from '@/lib/characters';
import { setActiveAction, setRoleAction, signOutAction } from '@/app/(app)/actions';

export function ProfileMenu({
  name, image, characters, activeId,
}: { name: string; image: string | null; characters: MyCharacter[]; activeId: number | null }) {
  const active = characters.find((c) => c.id === activeId) ?? null;
  return (
    <DetailsMenu className="profile">
      <summary>
        {image ? <img className="avatar" src={image} alt="" /> : <span className="avatar" />}
        <span>{active ? active.name : name}</span>
      </summary>
      <div className="menu">
        <strong>{name}</strong>
        {characters.length === 0 && <p className="muted">Du har ingen karakter endnu.</p>}
        {characters.map((c) => (
          <form key={c.id} action={setActiveAction}>
            <input type="hidden" name="characterId" value={c.id} />
            <button type="submit" className="btn secondary" style={{ width: '100%', margin: '6px 0' }} disabled={c.id === activeId}>
              {c.name} · {c.className} · {roleLabel(c.role)}
              {c.id === activeId ? ' (aktiv)' : ''}
            </button>
          </form>
        ))}
        {active && (
          <form key={`${active.id}-${active.role}`} action={setRoleAction} className="field">
            <input type="hidden" name="characterId" value={active.id} />
            <label htmlFor="role">Rolle for {active.name}</label>
            <select id="role" name="role" defaultValue={active.role}>
              {roles.map((r: Role) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
            <button type="submit" className="btn secondary">Gem rolle</button>
          </form>
        )}
        <p><Link href="/karakter/ny">Tilføj karakter</Link></p>
        <form action={signOutAction}><button type="submit" className="btn secondary logout">Log ud</button></form>
      </div>
    </DetailsMenu>
  );
}
