import Link from 'next/link';
import { Icon } from '@/components/icons';

/**
 * Fastgjort kort øverst i Overblik for medlemmer uden nogen karakter. Forsvinder af sig selv, når der er tilføjet en.
 * Ren server-komponent med et almindeligt link, så det virker uden JavaScript.
 */
export function FirstCharacterCard() {
  return (
    <section className="card first-character" aria-labelledby="first-character-title">
      <p className="pinned-label"><Icon name="opslag" size={16} /> Fastgjort · Kom i gang</p>
      <h2 id="first-character-title">Velkommen til AULA – tilføj din første karakter</h2>
      <p>
        Skriv din WoW-karakters navn (både fornavn og efternavn), og vælg din rolle. Så kan guilden se dig, du kan tilmelde dig
        begivenheder, og du kan simulere din karakter i Skolehjem.
      </p>
      <p className="actions">
        <Link href="/karakter/ny" className="btn first-character-cta">Tilføj karakter</Link>
      </p>
    </section>
  );
}
