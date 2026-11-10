import type { MyCharacter } from '@/lib/characters';
import type { Member } from '@/lib/session';
import { unreadLabel } from '@/lib/posts-ui';
import { NavLink } from './NavLink';
import { ProfileMenu } from './ProfileMenu';
import { ThemeToggle } from './ThemeToggle';

export function Shell({
  member, characters, activeId, unreadPosts = 0, children,
}: { member: Member; characters: MyCharacter[]; activeId: number | null; unreadPosts?: number; children: React.ReactNode }) {
  const unread = unreadLabel(unreadPosts);
  return (
    <>
      <header className="topbar">
        <div className="logo">Aula</div>
        <div className="topbar-right">
          <ThemeToggle />
          <ProfileMenu name={member.name} image={member.image} characters={characters} activeId={activeId} />
        </div>
      </header>
      <div className="layout">
        <nav className="sidenav" aria-label="Hovedmenu">
          <NavLink href="/">
            Overblik
            {unread && (
              <span className="unread-count">
                {unread}
                <span className="sr-only"> ulæste</span>
              </span>
            )}
          </NavLink>
          <NavLink href="/kalender">Kalender</NavLink>
          <NavLink href="/kontakter">Kontakter</NavLink>
        </nav>
        <main className="content">{children}</main>
      </div>
    </>
  );
}
