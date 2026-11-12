import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PostCard } from '@/components/PostCard';
import type { PostListItem } from '@/lib/posts';

// Server actions trækker next-auth med; kortets markup er det eneste, der testes her.
vi.mock('@/app/(app)/opslag/actions', () => ({ deletePostAction: async () => ({}), toggleBookmarkAction: async () => ({}) }));

const now = new Date('2026-11-10T12:00:00Z');
const post: PostListItem = {
  id: 7, title: 'Raid i aften', excerpt: 'Husk flasks.', authorId: 1, authorName: 'Rasmus', authorCharacter: null,
  authorCharacterFullName: null, createdAt: new Date('2026-11-10T08:05:00Z'), pinned: true, commentCount: 1, unread: true, bookmarked: false,
};
const html = (over: Partial<PostListItem> = {}, canDelete = false) =>
  renderToStaticMarkup(createElement(PostCard, { post: { ...post, ...over }, now, canDelete }));

describe('PostCard', () => {
  it('har samme kortmarkup som Overblik: badges, link, kommentartæller og data-post-id', () => {
    const h = html();
    expect(h).toContain('class="card post-card unread"');
    expect(h).toContain('data-post-id="7"');
    expect(h).toContain('>Vigtig<');
    expect(h).toContain('>Ny<');
    expect(h).toContain('href="/opslag/7"');
    expect(h).toContain('1 kommentar');
    expect(h).toContain('aria-label="Gem opslag"');
    expect(h).not.toContain('Slet opslag');
  });
  it('slet-knap kun når den må vises; læst opslag uden badges', () => {
    const h = html({ pinned: false, unread: false, commentCount: 3 }, true);
    expect(h).toContain('Slet opslag');
    expect(h).toContain('class="card post-card"');
    expect(h).not.toContain('post-badges');
    expect(h).toContain('3 kommentarer');
  });
});
