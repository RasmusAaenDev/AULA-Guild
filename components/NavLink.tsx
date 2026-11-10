'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './icons';

export function NavLink({ href, icon, badge, children }: { href: string; icon: IconName; badge?: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link href={href} className="navlink" aria-current={active ? 'page' : undefined}>
      <span className="navicon">
        <Icon name={icon} size={28} />
        {badge}
      </span>
      <span>{children}</span>
    </Link>
  );
}
