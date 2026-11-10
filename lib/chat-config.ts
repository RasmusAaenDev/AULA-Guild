import { env } from '@/lib/env';

export type ChatConfig = { token: string; channelId: string };

/** Ren validering. `warn` kaldes højst én gang og nævner kun variabelnavne, aldrig værdier. */
export function parseChatConfig(
  raw: { DISCORD_BOT_TOKEN?: string; DISCORD_CHAT_CHANNEL_ID?: string },
  warn: (message: string) => void,
): ChatConfig | null {
  const token = (raw.DISCORD_BOT_TOKEN ?? '').trim();
  const channelId = (raw.DISCORD_CHAT_CHANNEL_ID ?? '').trim();
  if (!token && !channelId) return null;
  if (!token) {
    warn('Chatten er slået fra: DISCORD_BOT_TOKEN mangler (DISCORD_CHAT_CHANNEL_ID er sat).');
    return null;
  }
  if (!channelId) {
    warn('Chatten er slået fra: DISCORD_CHAT_CHANNEL_ID mangler (DISCORD_BOT_TOKEN er sat).');
    return null;
  }
  if (!/^\d{5,25}$/.test(channelId)) {
    warn('Chatten er slået fra: DISCORD_CHAT_CHANNEL_ID skal være et tal (kanal-id).');
    return null;
  }
  return { token, channelId };
}

let warned = false;

/** Chat-opsætningen fra miljøet, eller null hvis den er ufuldstændig eller ugyldig. */
export function chatConfig(): ChatConfig | null {
  return parseChatConfig(env(), (m) => {
    if (warned) return;
    warned = true;
    console.warn(m);
  });
}
