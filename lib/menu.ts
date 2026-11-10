import type { IconName } from '@/components/icons';

export type MenuItem = { href: string; icon: IconName; label: string; badge?: 'posts' | 'events' };

/** Venstremenuens rækkefølge (efter AULA): Beskeder vises altid (egne kanaler kræver ikke Discord); tæller-bobler på Overblik og Kalender. */
export function menuItems(): MenuItem[] {
  return [
    { href: '/', icon: 'overblik', label: 'Overblik', badge: 'posts' },
    { href: '/kalender', icon: 'kalender', label: 'Kalender', badge: 'events' },
    { href: '/chat', icon: 'chat', label: 'Beskeder' },
    { href: '/galleri', icon: 'galleri', label: 'Galleri' },
    { href: '/kontakter', icon: 'kontakter', label: 'Kontakter' },
    { href: '/filer', icon: 'filer', label: 'Filer' },
  ];
}
