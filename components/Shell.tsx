import Link from 'next/link';
import type { MyCharacter } from '@/lib/characters';
import type { Member } from '@/lib/session';
import { menuHref, menuItems } from '@/lib/menu';
import { unreadLabel } from '@/lib/posts-ui';
import { CharacterSwitcher } from './CharacterSwitcher';
import { NavLink } from './NavLink';
import { ProfileMenu } from './ProfileMenu';
import { ThemeToggle } from './ThemeToggle';

export function Shell({
  member, characters, activeId, unreadPosts = 0, unansweredEvents = 0, simEnabled = false, children,
}: {
  member: Member;
  characters: MyCharacter[];
  activeId: number | null;
  unreadPosts?: number;
  unansweredEvents?: number;
  simEnabled?: boolean;
  children: React.ReactNode;
}) {
  const badges = {
    posts: { label: unreadLabel(unreadPosts), sr: ' ulæste' },
    events: { label: unreadLabel(unansweredEvents), sr: ' ubesvarede' },
  };
  return (
    <>
      <a className="skip-link" href="#main">Spring til indhold</a>
      <header className="topbar">
        <Link href="/" className="logo" aria-label="Aula, gå til forsiden">Aula</Link>
        <CharacterSwitcher characters={characters} activeId={activeId} />
        <div className="topbar-right">
          <ThemeToggle />
          <ProfileMenu name={member.name} characters={characters} activeId={activeId} />
        </div>
      </header>
      <div className="layout">
        <nav className="sidenav" aria-label="Hovedmenu">
          {menuItems({ simEnabled, viewer: member }).map((item) => {
            const b = item.badge ? badges[item.badge] : null;
            return (
              <NavLink
                key={item.href}
                href={menuHref(item)}
                icon={item.icon}
                locked={item.locked}
                badge={
                  b?.label && (
                    <span className="unread-count nav-badge">
                      {b.label}
                      <span className="sr-only">{b.sr}</span>
                    </span>
                  )
                }
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <main id="main" tabIndex={-1} className="content">{children}</main>
      </div>
    </>
  );
}
