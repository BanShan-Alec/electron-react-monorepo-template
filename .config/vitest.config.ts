import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { APP_DISPLAY } from '../build/lib/app-identity.ts';
import { findRepoRoot } from '../build/lib/repo-paths.ts';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = findRepoRoot(configDir);
const isBenchmark = process.env.BENCHMARK === 'true';

export default defineConfig({
  root: rootDir,
  tsconfig: path.join(rootDir, 'tsconfig.json'),
  // 别名真源：packages/tsconfig/base.json（Vite 8 原生 tsconfigPaths）
  resolve: {
    tsconfigPaths: true,
  },
  // 与 renderer 同一份构建期注入：shared/constants/app-info.ts 在单测里也要能求值（主进程不消费该常量，故 main 不注入）
  define: {
    __APP_INFO__: JSON.stringify(APP_DISPLAY),
  },
  test: {
    environment: 'node',
    globals: true,
    include: isBenchmark
      ? ['packages/main/tests/benchmark/**/*.test.ts']
      : ['packages/**/tests/unit/**/*.test.ts', 'packages/**/tests/**/*.test.ts'],
    exclude: isBenchmark
      ? ['**/node_modules/**', '**/dist/**']
      : [
          '**/node_modules/**',
          '**/dist/**',
          'packages/main/tests/benchmark/**',
          'packages/pr-review/**',
        ],
  },
});
