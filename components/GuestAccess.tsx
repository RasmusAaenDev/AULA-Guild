import Link from 'next/link';
import type { MyCharacter } from '@/lib/characters';
import { guestStatus, verifiedCountLabel, type Viewer } from '@/lib/guild-access-ui';
import { AccountRefreshForm } from './AccountRefreshForm';
import { GuildStar } from './GuildStar';
import { Icon } from './icons';
import { VerifiedMark } from './VerifiedMark';

/**
 * Gæstesiden (/ingen-adgang): hvorfor adgangen mangler, hvad brugeren har nu, og hvordan man selv bliver medlem
 * (karakter i guilden + log ind med Battle.net igen). Ren server-komponent; virker uden JavaScript.
 */
export function GuestAccess({ viewer, characters }: { viewer: Viewer; characters: MyCharacter[] }) {
  const st = guestStatus(characters);

  if (viewer.isGuildMember) {
    return (
      <>
        <h1>Du er med i guilden</h1>
        <section className="card">
          <p>Du har en verificeret karakter i guilden og har adgang til hele siden, også Skolehjem, Galleri og Filer.</p>
          <p className="actions"><Link href="/" className="btn">Til overblikket</Link></p>
        </section>
      </>
    );
  }

  // Databasen kan være foran sessionen (fx efter roster-synk): adgangen følger med inden for 10 minutter eller ved nyt login.
  const pending = st.verifiedInGuild > 0;

  return (
    <>
      <h1>Du er ikke i guilden endnu</h1>
      <section className="card" aria-labelledby="guest-why">
        <h2 id="guest-why">Hvorfor?</h2>
        <p>
          Skolehjem, Galleri og Filer, og at skrive opslag, oprette begivenheder og kommentere, er kun for guildens
          medlemmer. Du bliver medlem, når en karakter på din egen Battle.net-konto er i guilden.
        </p>
        <p className="muted">
          Indtil da kan du se Overblik, Kalender, opslag og Kontakter, bruge Beskeder og tilmelde dig begivenheder.
        </p>
      </section>

      <section className="card" aria-labelledby="guest-status">
        <h2 id="guest-status">Det har du nu</h2>
        <ul className="guest-status">
          <li>
            <span className={st.verified > 0 ? 'st-ok' : 'st-no'}><Icon name={st.verified > 0 ? 'deltager' : 'afbud'} size={18} /></span>
            <span>Du har {verifiedCountLabel(st.verified)} fra din Battle.net-konto.</span>
          </li>
          <li>
            <span className={pending ? 'st-ok' : 'st-no'}><Icon name={pending ? 'deltager' : 'afbud'} size={18} /></span>
            <span>
              {pending
                ? 'En af dem er i guilden. Din adgang opdateres inden for 10 minutter, eller med det samme hvis du opdaterer herunder.'
                : st.verified > 0
                  ? 'Ingen af dem er i guilden.'
                  : 'Ingen karakter i guilden.'}
            </span>
          </li>
          {st.unverifiedInGuild > 0 && (
            <li>
              <span className="st-no"><Icon name="udraab" size={18} /></span>
              <span>
                {st.unverifiedInGuild === 1 ? '1 karakter' : `${st.unverifiedInGuild} karakterer`} i guilden er tilføjet med navn
                og ikke verificeret. Står den på din Battle.net-konto, så opdatér herunder.
              </span>
            </li>
          )}
        </ul>
        {characters.length > 0 && (
          <>
            <h3>Dine karakterer</h3>
            <ul className="guest-chars">
              {characters.map((c) => (
                <li key={c.id}>
                  <strong>{c.fullName}</strong>
                  {c.inGuild && <GuildStar />}
                  <VerifiedMark verified={c.verified} /> · {c.className}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card" aria-labelledby="guest-how">
        <h2 id="guest-how">Sådan bliver du medlem</h2>
        <ol className="guest-steps">
          <li>Få din karakter med i guilden i spillet (spørg en officer om en invitation).</li>
          <li>
            Log ind med Battle.net igen. Så henter vi karaktererne på din konto, og er en af dem i guilden, får du adgang med
            det samme. Det kan tage lidt tid, før Blizzard viser nye medlemmer i guilden.
          </li>
        </ol>
        <div className="guest-actions">
          <AccountRefreshForm back="/ingen-adgang" primary id="guest-refresh-help" />
          <Link href="/karakter/ny" className="btn secondary">Tilføj karakter</Link>
        </div>
        <p className="muted verify-help">
          «Tilføj karakter» er til karakterer, der ikke står på din Battle.net-konto. De vises for guilden, men er ikke
          verificerede og giver ikke medlemskab.
        </p>
      </section>
    </>
  );
}
