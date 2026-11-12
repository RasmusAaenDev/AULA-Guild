import type { ChangeEventHandler, FormEventHandler } from 'react';
import { Icon } from '@/components/icons';

/** Skrivefeltet under beskederne: tekstfelt og send-knap på én linje. Selve afsendelsen ejes af kalderen. */
export function ChatComposer({
  channelId, bind, error, disabled, onSubmit,
}: {
  channelId: string | number;
  bind: { name: string; value: string; onChange: ChangeEventHandler<HTMLTextAreaElement> };
  error?: string;
  disabled: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  return (
    <form className="chat-form" onSubmit={onSubmit}>
      <input type="hidden" name="channelId" value={channelId} />
      <label htmlFor="chat-message" className="sr-only">Skriv en besked</label>
      <div className="chat-compose">
        <textarea id="chat-message" {...bind} rows={2} maxLength={500} required autoComplete="off" placeholder="Skriv en besked …" />
        <button type="submit" className="btn chat-send" disabled={disabled}>
          <Icon name="send" size={18} />
          <span>Send</span>
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
