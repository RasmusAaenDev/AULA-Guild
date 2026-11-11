import type { IconName } from '@/components/icons';

export type MenuItem = { href: string; icon: IconName; label: string; badge?: 'posts' | 'events' };

/** Venstremenuens rækkefølge (efter AULA): Sim vises kun når simulatoren er sat op; Beskeder vises altid (egne kanaler kræver ikke Discord); tæller-bobler på Overblik og Kalender. */
export function menuItems(opts: { simEnabled?: boolean } = {}): MenuItem[] {
  const items: MenuItem[] = [
    { href: '/', icon: 'overblik', label: 'Overblik', badge: 'posts' },
    { href: '/kalender', icon: 'kalender', label: 'Kalender', badge: 'events' },
    { href: '/chat', icon: 'chat', label: 'Beskeder' },
    ...(opts.simEnabled ? [{ href: '/sim', icon: 'sim' as const, label: 'Skolehjem' }] : []),
    { href: '/galleri', icon: 'galleri', label: 'Galleri' },
    { href: '/kontakter', icon: 'kontakter', label: 'Kontakter' },
    { href: '/filer', icon: 'filer', label: 'Filer' },
  ];
  return items;
}
