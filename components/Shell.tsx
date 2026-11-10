import type { MyCharacter } from '@/lib/characters';
import type { Member } from '@/lib/session';
import { unreadLabel } from '@/lib/posts-ui';
import { NavLink } from './NavLink';
import { ProfileMenu } from './ProfileMenu';
import { ThemeToggle } from './ThemeToggle';

export function Shell({
  member, characters, activeId, unreadPosts = 0, chatEnabled = false, children,
}: { member: Member; characters: MyCharacter[]; activeId: number | null; unreadPosts?: number; chatEnabled?: boolean; children: React.ReactNode }) {
  const unread = unreadLabel(unreadPosts);
  return (
    <>
      <a className="skip-link" href="#main">Spring til indhold</a>
      <header className="topbar">
        <div className="logo">Aula</div>
        <div className="topbar-right">
          <ThemeToggle />
          <ProfileMenu name={member.name} image={member.image} characters={characters} activeId={activeId} />
        </div>
      </header>
      <div className="layout">
        <nav className="sidenav" aria-label="Hovedmenu">
          <NavLink
            href="/"
            icon="overblik"
            badge={
              unread && (
                <span className="unread-count nav-badge">
                  {unread}
                  <span className="sr-only"> ulæste</span>
                </span>
              )
            }
          >
            Overblik
          </NavLink>
          <NavLink href="/kalender" icon="kalender">Kalender</NavLink>
          <NavLink href="/filer" icon="filer">Filer</NavLink>
          <NavLink href="/galleri" icon="galleri">Galleri</NavLink>
          {chatEnabled && <NavLink href="/chat" icon="chat">Chat</NavLink>}
          <NavLink href="/kontakter" icon="kontakter">Kontakter</NavLink>
        </nav>
        <main id="main" tabIndex={-1} className="content">{children}</main>
      </div>
    </>
  );
}
