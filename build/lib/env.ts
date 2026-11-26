import { loadEnv } from 'vite';
import { findRepoRoot } from './repo-paths';

const loadedRepoEnvKeys = new Set<string>();

/**
 * 幂等加载仓库根 .env / .env.[mode] 到 process.env，并返回仓库根目录路径。
 *
 * 规则：
 * - 外部注入（Shell / CI / cross-env）始终优先：仅当 process.env[key] === undefined 时回填
 * - 按 `${rootDir}::${mode}` 在进程内幂等缓存，避免构建链与 Vite 配置多次重复读盘
 */
export function ensureRepoEnv(fromDir: string, defaultMode = 'production'): string {
  const rootDir = findRepoRoot(fromDir);
  const mode = process.env.MODE || defaultMode;
  const cacheKey = `${rootDir}::${mode}`;

  if (loadedRepoEnvKeys.has(cacheKey)) {
    return rootDir;
  }

  const values = loadEnv(mode, rootDir, '');
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  loadedRepoEnvKeys.add(cacheKey);
  return rootDir;
}

/**
 * 仅用于单元测试清理进程内缓存，生产代码禁止调用
 */
export function resetRepoEnvCacheForTest(): void {
  loadedRepoEnvKeys.clear();
}
