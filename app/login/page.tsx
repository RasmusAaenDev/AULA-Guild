import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { error } = await searchParams;
  const session = await auth();
  if (session?.user?.id) redirect('/');
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
