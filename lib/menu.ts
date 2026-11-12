import type { IconName } from '@/components/icons';
import { NO_ACCESS_HREF, isGuildOnlyArea, type Viewer } from '@/lib/guild-access-ui';

export type MenuItem = {
  href: string;
  icon: IconName;
  label: string;
  badge?: 'posts' | 'events';
  /** Kræver guild-medlemskab, som seeren ikke har: vises med lås og linker til forklaringen (skjules ikke). */
  locked?: boolean;
};

/** Låst tekst til skærmlæsere og title. */
export const LOCKED_LABEL = 'kræver guild-medlemskab';

/**
 * Venstremenuens rækkefølge (efter AULA): Sim vises kun når simulatoren er sat op; Beskeder vises altid (egne kanaler kræver
 * ikke Discord); tæller-bobler på Overblik og Kalender. Uden `viewer` eller for medlemmer er intet låst; for gæster er
 * Skolehjem, Galleri og Filer låst.
 */
export function menuItems(opts: { simEnabled?: boolean; viewer?: Viewer } = {}): MenuItem[] {
  const items: MenuItem[] = [
    { href: '/', icon: 'overblik', label: 'Overblik', badge: 'posts' },
    { href: '/kalender', icon: 'kalender', label: 'Kalender', badge: 'events' },
    { href: '/chat', icon: 'chat', label: 'Beskeder' },
    ...(opts.simEnabled ? [{ href: '/sim', icon: 'sim' as const, label: 'Skolehjem' }] : []),
    { href: '/galleri', icon: 'galleri', label: 'Galleri' },
    { href: '/kontakter', icon: 'kontakter', label: 'Kontakter' },
    { href: '/filer', icon: 'filer', label: 'Filer' },
  ];
  const guest = opts.viewer !== undefined && !opts.viewer.isGuildMember;
  return guest ? items.map((i) => (isGuildOnlyArea(i.href) ? { ...i, locked: true } : i)) : items;
}

/** Hvor menupunktet linker hen: låste punkter til forklaringen for gæster. */
export function menuHref(item: MenuItem): string {
  return item.locked ? NO_ACCESS_HREF : item.href;
}
