import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChatItemCard } from '@/components/ChatItemCard';
import type { ChatItem } from '@/lib/overview-chat';

const now = new Date('2026-11-10T12:00:00Z');
const item: ChatItem = {
  id: 'discord-1-9', source: 'discord', channelId: '123', channelName: 'wow', author: 'Ragnar Storm',
  armoryUrl: 'https://worldofwarcraft.blizzard.com/en-gb/forever/eu/armory/character/ragnar-storm',
  content: 'Se https://example.com/side og <img src=x onerror=alert(1)> & mere', at: new Date('2026-11-10T08:05:00Z'),
};
const render = (i: ChatItem) => renderToStaticMarkup(createElement(ChatItemCard, { item: i, now }));

describe('ChatItemCard', () => {
  const html = render(item);
  it('har overskrift, chat-ikon og tidspunkt som opslagskort', () => {
    expect(html).toContain('chat-item-card');
    expect(html).toContain('data-icon="chat"');
    expect(html).toMatch(/<h3[^>]*>[\s\S]*Ragnar Storm[\s\S]*i #wow<\/span><\/h3>/);
    expect(html).toContain('<time class="muted" dateTime="2026-11-10T08:05:00.000Z" title="10.11.2026 09.05">I dag 09:05</time>');
  });
  it('linker forfatteren til armory i ny fane', () => {
    expect(html).toMatch(/<a href="https:\/\/worldofwarcraft[^"]*ragnar-storm" target="_blank" rel="noopener noreferrer"[^>]*>Ragnar Storm<\/a>/);
    expect(render({ ...item, armoryUrl: null })).not.toContain('armory');
  });
  it('linkificerer rene links og indsætter aldrig HTML', () => {
    expect(html).toMatch(/<a class="chat-link" href="https:\/\/example.com\/side" target="_blank" rel="noopener noreferrer nofollow">/);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
  it('har «Åbn i Beskeder»-link til kanalen', () => {
    expect(html).toContain('<a href="/chat?kanal=123">Åbn i Beskeder</a>');
    expect(render({ ...item, source: 'site', channelId: 'egen-7' })).toContain('href="/chat?kanal=egen-7"');
  });
});
