import Link from 'next/link';
import { NO_ACCESS_HREF } from '@/lib/guild-access-ui';
import { Icon } from './icons';

/** Kort hint i stedet for en opret-/skrive-knap, som gæster ikke kan bruge. Linker til forklaringen. */
export function GuildOnlyHint({ what }: { what?: string }) {
  return (
    <p className="guild-only-hint">
      <Icon name="laas" size={16} />
      <span>{what ? `${what}: kun for guildmedlemmer.` : 'Kun for guildmedlemmer.'}</span>
      <Link href={NO_ACCESS_HREF}>Sådan bliver du medlem</Link>
    </p>
  );
}
