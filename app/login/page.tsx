import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.isMember) redirect('/');
  return (
    <main className="center-card">
      <h1>AULA</h1>
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
