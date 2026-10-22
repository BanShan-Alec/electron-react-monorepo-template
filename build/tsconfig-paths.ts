import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * TypeScript 路径别名单一事实源
 *
 * 真源是 packages/tsconfig/base.json 的 compilerOptions.paths；
 * Vitest 等需要显式 alias 的工具从这里派生，禁止再手写一份 @app/* 列表。
 */
export interface ViteAlias {
  find: string | RegExp;
  replacement: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function readTsconfigAliases(rootDir: string): ViteAlias[] {
  const tsconfigDir = path.join(rootDir, 'packages', 'tsconfig');
  const baseConfig = JSON.parse(readFileSync(path.join(tsconfigDir, 'base.json'), 'utf-8')) as {
    compilerOptions?: { paths?: Record<string, string[]> };
  };
  const paths = baseConfig.compilerOptions?.paths ?? {};

  const wildcardAliases: ViteAlias[] = [];
  const exactAliases: ViteAlias[] = [];

  for (const [key, targets] of Object.entries(paths)) {
    const target = targets[0];
    if (!target) continue;

    if (key.endsWith('/*')) {
      const prefix = key.slice(0, -2);
      const absolute = path.resolve(tsconfigDir, target.slice(0, -2));
      wildcardAliases.push({
        find: new RegExp(`^${escapeRegExp(prefix)}/(.*)$`),
        replacement: `${absolute}/$1`,
      });
      // 裸包名（如 @app/shared）也指向目录；单独的 "@" 不是合法导入，跳过
      if (prefix !== '@') {
        exactAliases.push({ find: prefix, replacement: absolute });
      }
    } else {
      exactAliases.push({ find: key, replacement: path.resolve(tsconfigDir, target) });
    }
  }

  // 通配符优先，避免裸前缀别名截获 @app/shared/xxx 这类子路径
  return [...wildcardAliases, ...exactAliases];
}
