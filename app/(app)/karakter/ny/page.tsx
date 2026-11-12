import { AccountRefreshForm } from '@/components/AccountRefreshForm';
import { AddCharacterForm } from './AddCharacterForm';

export default function NewCharacterPage() {
  return (
    <>
      <h1>Tilføj karakter</h1>
      <section className="card" aria-labelledby="account-chars-title">
        <h2 id="account-chars-title">Karakterer fra din Battle.net-konto</h2>
        <p>
          Når du logger ind, henter vi karaktererne på din Battle.net-konto og markerer dem som verificerede. Kun
          verificerede karakterer i guilden giver adgang til guildens områder. Mangler en ny karakter, så opdatér herunder.
        </p>
        <AccountRefreshForm back="/karakter/ny" primary />
      </section>
      <h2>Tilføj med navn</h2>
      <p className="muted">
        Karakteren slås op i armory og skal findes på WoW Forever. Er den i guilden, markeres den med en stjerne (★). Klasse,
        spec og item level hentes automatisk. En karakter tilføjet med navn er «ikke verificeret»: den tæller ikke til
        guild-medlemskab eller officer-rang, før den står på din Battle.net-konto.
      </p>
      <AddCharacterForm />
    </>
  );
}
