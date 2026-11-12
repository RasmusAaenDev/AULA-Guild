'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCKED_LABEL } from '@/lib/menu';
import { Icon, type IconName } from './icons';

/**
 * Menupunkt. `locked`: området kræver guild-medlemskab; punktet vises stadig (med lås) og linker til forklaringen, og
 * navnet for skærmlæsere bliver «Galleri, kræver guild-medlemskab». Et låst punkt markeres aldrig som aktuel side.
 */
export function NavLink({
  href, icon, badge, locked = false, children,
}: { href: string; icon: IconName; badge?: React.ReactNode; locked?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = !locked && (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={locked ? 'navlink locked' : 'navlink'}
      aria-current={active ? 'page' : undefined}
      title={locked ? `Kræver guild-medlemskab` : undefined}
    >
      <span className="navicon">
        <Icon name={icon} size={28} />
        {badge}
        {locked && (
          <span className="nav-lock" aria-hidden="true">
            <Icon name="laas" size={12} />
          </span>
        )}
      </span>
      <span>
        {children}
        {locked && <span className="sr-only">, {LOCKED_LABEL}</span>}
      </span>
    </Link>
  );
}
