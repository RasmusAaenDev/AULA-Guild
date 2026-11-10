import Link from 'next/link';
import { DetailsMenu } from './DetailsMenu';
import { Icon, type IconName } from './icons';

const items: { href: string; icon: IconName; label: string }[] = [
  { href: '/opslag/ny', icon: 'opslag', label: 'Opslag' },
  { href: '/kalender/ny', icon: 'kalender', label: 'Begivenhed' },
  { href: '/filer', icon: 'filer', label: 'Fil' },
  { href: '/galleri', icon: 'galleri', label: 'Billede' },
];

/** «Opret»-dropdown (som i AULA): fælles startsted for opslag, begivenhed, fil og billede. */
export function CreateMenu() {
  return (
    <DetailsMenu className="create">
      <summary className="btn secondary">
        <Icon name="opret" size={18} /> Opret <Icon name="pil-ned" size={18} />
      </summary>
      <ul className="menu">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href}><Icon name={i.icon} size={20} /> {i.label}</Link>
          </li>
        ))}
      </ul>
    </DetailsMenu>
  );
}
