import { describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { z } from 'zod';

describe('afhængigheder', () => {
  it('kan importeres og bruges', () => {
    expect(typeof postgres).toBe('function');
    expect(typeof drizzle).toBe('function');
    expect(z.string().parse('ok')).toBe('ok');
  });
});
