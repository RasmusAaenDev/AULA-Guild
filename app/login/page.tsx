import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';

// Fra Battle.net kan to kald til /api/auth/callback komme næsten samtidig; det ene uden login-cookies fejler og sender brugeren hertil,
// mens det andet stadig er ved at oprette sessionen. Derfor venter vi et øjeblik og tjekker igen, før fejlen vises.
const RECHECK_SECONDS = 4;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[]; checked?: string | string[] }> }) {
  const { error, checked } = await searchParams;
  const session = await auth();
  if (session?.user?.id) redirect('/');
  if (error && !checked) {
    return (
      <main className="center-card">
        <meta httpEquiv="refresh" content={`${RECHECK_SECONDS};url=/login?error=${encodeURIComponent(String(error))}&checked=1`} />
        <h1>AULA</h1>
        <p role="status">Tjekker dit login …</p>
      </main>
    );
  }
  return (
    <main className="center-card">
      <h1>AULA</h1>
      {error ? (
        <p role="alert" className="error">
          Login mislykkedes. Battle.net svarer ikke lige nu, eller noget gik galt. Prøv igen om lidt.
        </p>
      ) : null}
      <p>Log ind med din Battle.net-konto for at komme ind på guildens side.</p>
      <form
        action={async () => {
          'use server';
          await signIn('battlenet', { redirectTo: '/' });
        }}
      >
        <button type="submit" className="btn">Log ind med Battle.net</button>
      </form>
    </main>
  );
}
