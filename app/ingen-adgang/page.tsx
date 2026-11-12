import Link from 'next/link';

// Midlertidig side; den rigtige gæsteside kommer i plan-opgave 6.
export default function NoAccessPage() {
  return (
    <main className="center-card">
      <h1>Kun for guildens medlemmer</h1>
      <p>
        Denne del af siden kræver, at du har en karakter i guilden på din Battle.net-konto. Log ind igen, når din
        karakter er med i guilden.
      </p>
      <p>
        <Link href="/">Til forsiden</Link>
      </p>
    </main>
  );
}
