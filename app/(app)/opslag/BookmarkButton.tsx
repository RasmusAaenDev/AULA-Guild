'use client';

import { useActionState } from 'react';
import { Icon } from '@/components/icons';
import { toggleBookmarkAction, type FormState } from './actions';

/** Bogmærkeknap med ikon og `aria-pressed`; viser serverens fejl. */
export function BookmarkButton({ postId, bookmarked }: { postId: number; bookmarked: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(toggleBookmarkAction, {});
  const label = bookmarked ? 'Fjern fra gemte' : 'Gem opslag';
  return (
    <form action={action} className="bookmark-form">
      <input type="hidden" name="postId" value={postId} />
      <button type="submit" className="icon-btn" aria-pressed={bookmarked} aria-label={label} title={label} disabled={pending}>
        <Icon name="bogmaerke" size={22} filled={bookmarked} />
      </button>
      {state.error && <p className="error" role="alert">{state.error}</p>}
    </form>
  );
}
