import mainPackageJson from '../packages/main/package.json';

/**
 * 主进程运行时依赖边界单一事实源
 *
 * `packages/main/package.json` 的 dependencies 是唯一声明处；
 * Vite external 从这里派生，杜绝两侧手写清单漂移。
 * JSON 静态导入，Vite / jiti 在加载期解析，缺失即构建失败。
 */
const mainPkg = mainPackageJson as { dependencies?: Record<string, string> };

/** 主进程生产依赖（过滤 @app/* workspace 子包） */
export const MAIN_RUNTIME_DEPENDENCIES = Object.keys(mainPkg.dependencies ?? {}).filter(
  (dep) => !dep.startsWith('@app/'),
);

/** Vite external：Electron 内置 + 全部主进程运行时依赖 */
export const MAIN_EXTERNAL_MODULES = ['electron', ...MAIN_RUNTIME_DEPENDENCIES];
