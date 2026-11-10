'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { markReadAction } from './actions';

/** Markerer opslaget som læst ved visning (kun hvis det er ulæst) og opdaterer tælleren. */
export function MarkRead({ postId, unread }: { postId: number; unread: boolean }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (!unread || done.current) return;
    done.current = true; // undgå dobbeltkald i StrictMode
    markReadAction(postId)
      .then(() => router.refresh())
      .catch(() => {});
  }, [postId, unread, router]);
  return null;
}
