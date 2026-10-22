import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 主进程运行时依赖边界单一事实源
 *
 * `packages/main/package.json` 的 dependencies 是唯一声明处；
 * Vite external 与打包前置门禁都从这里派生，杜绝两侧手写清单漂移。
 */
export function getMainRuntimeDependencies(rootDir: string): string[] {
  const pkgPath = path.join(rootDir, 'packages', 'main', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
    dependencies?: Record<string, string>;
  };
  return Object.keys(pkg.dependencies ?? {}).filter((dep) => !dep.startsWith('@app/'));
}

/** Vite external：Electron 内置 + 全部主进程运行时依赖 */
export function getMainExternalModules(rootDir: string): string[] {
  return ['electron', ...getMainRuntimeDependencies(rootDir)];
}
