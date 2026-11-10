import { describe, expect, it } from 'vitest';
import { parseChatConfig } from '@/lib/chat-config';

const run = (raw: { DISCORD_BOT_TOKEN?: string; DISCORD_CHAT_CHANNEL_ID?: string }) => {
  const warnings: string[] = [];
  const config = parseChatConfig(raw, (m) => warnings.push(m));
  return { config, warnings };
};

describe('parseChatConfig', () => {
  it('giver konfiguration når begge er gyldige', () => {
    const r = run({ DISCORD_BOT_TOKEN: 'tok.en', DISCORD_CHAT_CHANNEL_ID: '123456789012345678' });
    expect(r.config).toEqual({ token: 'tok.en', channelId: '123456789012345678' });
    expect(r.warnings).toEqual([]);
  });
  it('trimmer mellemrum', () => {
    expect(run({ DISCORD_BOT_TOKEN: ' tok ', DISCORD_CHAT_CHANNEL_ID: ' 12345678 \n' }).config)
      .toEqual({ token: 'tok', channelId: '12345678' });
  });
  it('er stille når ingen af dem er sat', () => {
    const r = run({});
    expect(r.config).toBeNull();
    expect(r.warnings).toEqual([]);
    expect(run({ DISCORD_BOT_TOKEN: ' ', DISCORD_CHAT_CHANNEL_ID: '' }).warnings).toEqual([]);
  });
  it('mangler token: null og én advarsel med variabelnavn', () => {
    const r = run({ DISCORD_CHAT_CHANNEL_ID: '12345678' });
    expect(r.config).toBeNull();
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('DISCORD_BOT_TOKEN');
  });
  it('mangler kanal: null og advarsel', () => {
    const r = run({ DISCORD_BOT_TOKEN: 'hemmeligt' });
    expect(r.config).toBeNull();
    expect(r.warnings[0]).toContain('DISCORD_CHAT_CHANNEL_ID');
  });
  it.each(['12ab5678', '"12345678"', '1234 5678', '123', '1'.repeat(26)])('afviser kanal-id %j uden at vise værdien', (id) => {
    const r = run({ DISCORD_BOT_TOKEN: 'hemmeligt-token', DISCORD_CHAT_CHANNEL_ID: id });
    expect(r.config).toBeNull();
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('DISCORD_CHAT_CHANNEL_ID');
    expect(r.warnings[0]).not.toContain('hemmeligt-token');
    expect(r.warnings[0]).not.toContain(id);
  });
});
