import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@mahjong/shared': path.resolve(here, 'shared/src/index.ts'),
    },
  },
  test: {
    include: [
      'shared/src/**/*.test.ts',
      'server/src/**/*.test.ts',
      'client/src/**/*.test.tsx',
    ],
  },
});
