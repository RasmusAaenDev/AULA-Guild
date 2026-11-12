import Link from 'next/link';
import { Icon } from '@/components/icons';
import { listMyCharacters } from '@/lib/characters';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { isSimConfigured } from '@/lib/services';
import { requireGuildMember } from '@/lib/session';
import { FIGHT_STYLES, listMySims } from '@/lib/sims';
import { isActiveStatus, parseSubjectFilter, previousDps, simSubject, subjectFilterNames, type PreviousDps } from '@/lib/sims-ui';
import { AutoRefresh } from './AutoRefresh';
import { NewSimPanel } from './NewSimPanel';
import { SimCard } from './SimCard';
import { SimStreamer } from './SimStreamer';

export const dynamic = 'force-dynamic';

export default async function SimPage({ searchParams }: { searchParams: Promise<{ karakter?: string | string[] }> }) {
  const member = await requireGuildMember();
  if (!isSimConfigured()) {
    return (
      <>
        <h1>Skolehjem</h1>
        <section className="card"><p>Simulation er ikke sat op.</p></section>
      </>
    );
  }
  const [sims, mine, [user], sp] = await Promise.all([
    listMySims(getDb(), member.userId, 10),
    listMyCharacters(getDb(), member.userId),
    getDb().select({ active: users.activeCharacterId }).from(users).where(eq(users.id, member.userId)),
    searchParams,
  ]);
  const activeCharacterName = mine.find((c) => c.id === user?.active)?.fullName ?? null;
  const now = new Date();
  const active = sims.some((s) => isActiveStatus(s.status));
  const subjects = sims.map((s) => simSubject(s, mine));
  const names = subjects.map((s) => s.name);
  const filterNames = subjectFilterNames(subjects);
  const filter = parseSubjectFilter(sp.karakter, filterNames);
  // Et job, der venter eller kører, vises altid – også når der er filtreret på en anden karakter – så det nye kort aldrig gemmer sig.
  const shown = sims.map((sim, i) => ({ sim, subject: subjects[i], index: i })).filter((x) => filter === null || x.subject.name === filter || isActiveStatus(x.sim.status));
  return (
    <>
      <h1>Skolehjem</h1>
      <p className="muted sim-lead">
        Simulér din karakters skade med SimulationCraft. Tallene er vejledende: simulatoren til WoW Forever er ny, og rotationerne er simple, så sammenlign ikke med retail.
      </p>

      <NewSimPanel
        characters={mine.map((c) => ({ id: c.id, fullName: c.fullName, className: c.className }))}
        activeCharacterName={activeCharacterName}
        defaultOpen={sims.length === 0}
        streamer={active ? <SimStreamer sims={sims} subjects={subjects} /> : null}
      />

      <section className="sim-list-section" aria-labelledby="sims-h">
        <div className="section-head">
          <h2 id="sims-h">Dine seneste simulationer</h2>
          {active && <p className="sim-live muted"><span className="sim-spinner" aria-hidden="true" /> Opdaterer automatisk</p>}
        </div>
        <AutoRefresh active={active} />
        {filterNames.length > 0 && (
          <nav className="tabs sim-filter" aria-label="Vis simulationer for">
            <Link href="/sim" className="tab" aria-current={filter === null ? 'page' : undefined}>Alle</Link>
            {filterNames.map((n) => (
              <Link key={n} href={`/sim?karakter=${encodeURIComponent(n)}`} className="tab" aria-current={filter === n ? 'page' : undefined}>{n}</Link>
            ))}
          </nav>
        )}
        {sims.length === 0 ? (
          <section className="card sim-empty">
            <Icon name="sim" size={40} />
            <h3>Ingen simulationer endnu</h3>
            <p>
              Skriv en karakters navn i «Ny simulation» ovenfor (din egen eller en hvilken som helst på WoW Forever), eller indsæt din SimC-tekst, og tryk «Kør simulation».
              Resultatet kommer her, typisk inden for et minut, og du kan følge loggen imens.
            </p>
            <p className="muted">Du finder også sim-knapperne ved dine karakterer under <Link href="/kontakter">Kontakter</Link> og på <Link href="/">Overblik</Link>.</p>
          </section>
        ) : shown.length === 0 ? (
          <section className="card"><p className="muted">Ingen simulationer for det valg.</p></section>
        ) : (
          <ul className="sim-list">
            {shown.map(({ sim, subject, index }) => {
              const previous: Partial<Record<string, PreviousDps | null>> = {};
              for (const fs of FIGHT_STYLES) previous[fs] = previousDps(sims, names, index, fs);
              return <SimCard key={sim.id} sim={sim} subject={subject} previous={previous} now={now} latest={index === 0} />;
            })}
          </ul>
        )}
      </section>
    </>
  );
}
