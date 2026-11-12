import { avatarColor, initialOf } from '@/lib/avatar';

/** Rund avatar med navnets initial og en farve afledt af navnet. Rent visuel: navnet står altid som tekst ved siden af. */
export function InitialAvatar({ name, className }: { name: string; className: string }) {
  return (
    <span className={`${className} sat-av-${avatarColor(name)}`} aria-hidden="true">
      {initialOf(name)}
    </span>
  );
}
