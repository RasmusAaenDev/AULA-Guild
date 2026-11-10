import { defineConfig } from 'vitest/config';
import path from 'node:path';

process.env.TEST_DATABASE_URL ??= 'postgres://aula:aula@127.0.0.1:55433/aula_test';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
  },
});
