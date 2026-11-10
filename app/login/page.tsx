import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { error } = await searchParams;
  const session = await auth();
  if (session?.user?.isMember) redirect('/');
  return (
    <main className="center-card">
      <h1>AULA</h1>
      {error ? (
        <p role="alert" className="error">
          Login mislykkedes. Discord svarer ikke lige nu, eller noget gik galt. Prøv igen om lidt.
        </p>
      ) : null}
      <p>Log ind med Discord for at komme ind på guildens side.</p>
      <form
        action={async () => {
          'use server';
          await signIn('discord', { redirectTo: '/' });
        }}
      >
        <button type="submit" className="btn">Log ind med Discord</button>
      </form>
    </main>
  );
}
