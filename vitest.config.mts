import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@app/shared': path.resolve(import.meta.dirname, 'packages/shared/src'),
      '@app/main': path.resolve(import.meta.dirname, 'packages/main/src'),
      '@app/preload': path.resolve(import.meta.dirname, 'packages/preload/src'),
      '@app/renderer': path.resolve(import.meta.dirname, 'packages/renderer/src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts', 'packages/**/*.test.ts'],
  },
});
