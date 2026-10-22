import fs from 'node:fs';
import path from 'node:path';

/**
 * 仓库物理路径解析（构建期基础设施单一事实源）
 *
 * 所有脚本与 Vite 配置统一从这里取根目录，禁止用 process.cwd() 推导
 * （桌面快捷方式/CI 工作目录偏移会让相对路径失效，见 AGENTS.md 全局红线 3）。
 */

/**
 * 从任意子目录向上定位仓库根（同时存在 package.json 与 pnpm-workspace.yaml）。
 * 不依赖调用方的目录深度，新增 scripts/build/config 文件无需重新计算 `../..`。
 */
export function findRepoRoot(fromDir: string): string {
  let current = path.resolve(fromDir);
  while (true) {
    if (
      fs.existsSync(path.join(current, 'package.json')) &&
      fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`[repo-paths] 无法从 ${fromDir} 向上定位仓库根目录`);
    }
    current = parent;
  }
}

/** 打包产物目录：允许 DIST_DIR 覆盖，默认 <root>/dist */
export function getDistDir(rootDir: string): string {
  if (!process.env.DIST_DIR) return path.join(rootDir, 'dist');
  return path.resolve(rootDir, process.env.DIST_DIR);
}
