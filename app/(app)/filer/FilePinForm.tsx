'use client';

import { useActionState } from 'react';
import { setFilePinnedAction, type FormState } from './actions';

export function FilePinForm({ fileId, pinned }: { fileId: number; pinned: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setFilePinnedAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="fileId" value={fileId} />
      <input type="hidden" name="pinned" value={pinned ? 'false' : 'true'} />
      <button type="submit" className="btn secondary" disabled={pending}>
        {pending ? 'Vent …' : pinned ? 'Frigør' : 'Fastgør'}
      </button>
      {state.error && <p className="error" role="alert">{state.error}</p>}
    </form>
  );
}
