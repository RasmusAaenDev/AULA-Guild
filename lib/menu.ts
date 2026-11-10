import type { IconName } from '@/components/icons';

export type MenuItem = { href: string; icon: IconName; label: string; badge?: 'posts' | 'events' };

/** Venstremenuens rækkefølge (efter AULA): Chat vises kun når den er sat op; tæller-bobler på Overblik og Kalender. */
export function menuItems({ chat }: { chat: boolean }): MenuItem[] {
  return [
    { href: '/', icon: 'overblik', label: 'Overblik', badge: 'posts' },
    { href: '/kalender', icon: 'kalender', label: 'Kalender', badge: 'events' },
    ...(chat ? [{ href: '/chat', icon: 'chat' as const, label: 'Beskeder' }] : []),
    { href: '/galleri', icon: 'galleri', label: 'Galleri' },
    { href: '/kontakter', icon: 'kontakter', label: 'Kontakter' },
    { href: '/filer', icon: 'filer', label: 'Filer' },
  ];
}
