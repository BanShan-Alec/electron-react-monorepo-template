import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..');
const isBenchmark = process.env.BENCHMARK === 'true';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@app\/shared\/(.*)/,
        replacement: path.resolve(rootDir, 'packages/shared/src/$1'),
      },
      {
        find: '@app/shared',
        replacement: path.resolve(rootDir, 'packages/shared/src'),
      },
      {
        find: /^@app\/main\/(.*)/,
        replacement: path.resolve(rootDir, 'packages/main/src/$1'),
      },
      {
        find: '@app/main',
        replacement: path.resolve(rootDir, 'packages/main/src'),
      },
      {
        find: /^@app\/preload\/(.*)/,
        replacement: path.resolve(rootDir, 'packages/preload/src/$1'),
      },
      {
        find: '@app/preload',
        replacement: path.resolve(rootDir, 'packages/preload/src'),
      },
      {
        find: /^@app\/renderer\/(.*)/,
        replacement: path.resolve(rootDir, 'packages/renderer/src/$1'),
      },
      {
        find: '@app/renderer',
        replacement: path.resolve(rootDir, 'packages/renderer/src'),
      },
    ],
  },
  test: {
    environment: 'node',
    globals: true,
    include: isBenchmark
      ? ['packages/main/tests/benchmark/**/*.test.ts']
      : ['packages/**/tests/unit/**/*.test.ts', 'packages/**/tests/**/*.test.ts'],
    exclude: isBenchmark
      ? ['**/node_modules/**', '**/dist/**']
      : ['**/node_modules/**', '**/dist/**', 'packages/main/tests/benchmark/**'],
  },
});
