import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
vi.mock('@/auth', () => ({ auth: () => authMock() }));
class Redirect extends Error {
  constructor(public to: string) {
    super(`redirect:${to}`);
  }
}
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));

import { requireGuildMember, requireOfficer, requireUser } from '@/lib/session';

const session = (over: object) => ({ user: { id: 7, name: 'Magi', image: null, isGuildMember: true, isOfficer: false, ...over } });

beforeEach(() => authMock.mockReset());

describe('requireUser', () => {
  it('sender uden session til /login', async () => {
    authMock.mockResolvedValue(null);
    await expect(requireUser()).rejects.toMatchObject({ to: '/login' });
  });
  it('sender session uden bruger-id til /login', async () => {
    authMock.mockResolvedValue(session({ id: 0 }));
    await expect(requireUser()).rejects.toMatchObject({ to: '/login' });
  });
  it('giver gæster adgang', async () => {
    authMock.mockResolvedValue(session({ isGuildMember: false }));
    expect(await requireUser()).toEqual({ userId: 7, name: 'Magi', isGuildMember: false, isOfficer: false });
  });
  it('falder tilbage til «Ukendt» uden navn', async () => {
    authMock.mockResolvedValue(session({ name: null }));
    expect((await requireUser()).name).toBe('Ukendt');
  });
});

describe('requireGuildMember', () => {
  it('sender uden session til /login', async () => {
    authMock.mockResolvedValue(null);
    await expect(requireGuildMember()).rejects.toMatchObject({ to: '/login' });
  });
  it('sender gæster til /ingen-adgang', async () => {
    authMock.mockResolvedValue(session({ isGuildMember: false }));
    await expect(requireGuildMember()).rejects.toMatchObject({ to: '/ingen-adgang' });
  });
  it('giver medlemmer adgang', async () => {
    authMock.mockResolvedValue(session({}));
    expect(await requireGuildMember()).toEqual({ userId: 7, name: 'Magi', isGuildMember: true, isOfficer: false });
  });
});

describe('requireOfficer', () => {
  it('sender uden session til /login', async () => {
    authMock.mockResolvedValue(null);
    await expect(requireOfficer()).rejects.toMatchObject({ to: '/login' });
  });
  it('afviser medlem uden officer-rang', async () => {
    authMock.mockResolvedValue(session({}));
    await expect(requireOfficer()).rejects.toThrow('Forbidden');
  });
  it('afviser gæst', async () => {
    authMock.mockResolvedValue(session({ isGuildMember: false }));
    await expect(requireOfficer()).rejects.toThrow('Forbidden');
  });
  it('giver officer adgang', async () => {
    authMock.mockResolvedValue(session({ isOfficer: true }));
    expect(await requireOfficer()).toMatchObject({ userId: 7, isOfficer: true });
  });
});
