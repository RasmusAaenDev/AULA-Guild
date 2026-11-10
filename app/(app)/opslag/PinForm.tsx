'use client';

import { useActionState } from 'react';
import { setPinnedAction, type FormState } from './actions';

export function PinForm({ postId, pinned }: { postId: number; pinned: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setPinnedAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="pinned" value={pinned ? 'false' : 'true'} />
      <button type="submit" className="btn secondary" disabled={pending}>
        {pending ? 'Vent …' : pinned ? 'Frigør' : 'Fastgør'}
      </button>
      {state.error && <p className="error" role="alert">{state.error}</p>}
    </form>
  );
}
