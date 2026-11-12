import Link from 'next/link';
import { requireGuildMember } from '@/lib/session';
import { PostForm } from '../PostForm';

export default async function NewPostPage() {
  await requireGuildMember();
  return (
    <>
      <h1>Nyt opslag</h1>
      <PostForm />
      <p><Link href="/">Tilbage til overblikket</Link></p>
    </>
  );
}
