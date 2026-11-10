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

import { requireMember, requireOfficer } from '@/lib/session';

const user = (over: object) => ({ user: { id: 7, name: 'R', image: null, isMember: true, isOfficer: false, ...over } });

beforeEach(() => authMock.mockReset());

describe('requireMember', () => {
  it('sender uden session til /login', async () => {
    authMock.mockResolvedValue(null);
    await expect(requireMember()).rejects.toMatchObject({ to: '/login' });
  });
  it('sender ikke-medlem til /ingen-adgang', async () => {
    authMock.mockResolvedValue(user({ isMember: false, id: 0 }));
    await expect(requireMember()).rejects.toMatchObject({ to: '/ingen-adgang' });
  });
  it('giver medlem adgang', async () => {
    authMock.mockResolvedValue(user({}));
    expect(await requireMember()).toEqual({ userId: 7, name: 'R', image: null, isOfficer: false });
  });
});

describe('requireOfficer', () => {
  it('afviser medlem uden officer-rolle', async () => {
    authMock.mockResolvedValue(user({}));
    await expect(requireOfficer()).rejects.toThrow('Forbidden');
  });
  it('giver officer adgang', async () => {
    authMock.mockResolvedValue(user({ isOfficer: true }));
    expect((await requireOfficer()).isOfficer).toBe(true);
  });
  it('afviser ikke-medlem før officer-tjekket', async () => {
    authMock.mockResolvedValue(user({ isMember: false, isOfficer: true, id: 0 }));
    await expect(requireOfficer()).rejects.toMatchObject({ to: '/ingen-adgang' });
  });
});
