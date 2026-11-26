import path from 'node:path';
import {
  APP_ENV,
  type AppEnv,
  RUNTIME_ENV_KEYS,
  type RuntimeEnvKey,
} from '@app/shared/constants/env';
import type { AppRuntimeEnv } from '@app/shared/types/env';
import { APP_ENV_ARG_PREFIX, packRuntimeEnv } from '@app/shared/utils/env-packer';
import { app } from 'electron';

/** 构建期注入的仓库根目录（仅主进程 bundle，见 packages/main/vite.config.ts） */
const BUILD_REPO_ROOT = typeof __BUILD_REPO_ROOT__ !== 'undefined' ? __BUILD_REPO_ROOT__ : '';

/** 是否拿到构建期仓库标识；缺失时无法区分就地副本与安装副本（旧产物 / 打包配置出错） */
export const hasBuildRepoRoot: boolean = Boolean(BUILD_REPO_ROOT);

/**
 * 是否处于自动化测试环境 (Playwright / Vitest)
 * 由测试启动器注入 MODE=test 或 Vitest/NODE_ENV 运行环境
 */
export const isTest: boolean =
  process.env.MODE === 'test' || process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

/**
 * 是否处于已打包二进制分发形态 (.exe / .app / AppImage)
 * Electron 官方权威判定，打包后二进制恒为 true
 */
export const isPackaged: boolean = Boolean(app?.isPackaged);

/**
 * 是否处于本地开发态
 * 判定原则：未打包 + 非测试模式 + MODE 未显式指定为 production
 */
export const isDev: boolean = !isPackaged && !isTest && process.env.MODE !== 'production';

/**
 * 是否处于生产行为态
 * 判定原则：非测试模式，且已打包或 MODE 显式为 production（例如 preview 预览）
 */
export const isProd: boolean = !isTest && (isPackaged || process.env.MODE === 'production');

/**
 * 副本形态判定的可选注入参数
 *
 * 默认全部取真实运行环境；测试通过注入构造边界场景，不把判定逻辑剥成外部微型函数。
 */
export interface InstalledCopyOptions {
  /** 是否处于已打包形态（默认 app.isPackaged） */
  packaged?: boolean;
  /** 构建期注入的仓库根目录（默认取编译期常量） */
  repoRoot?: string;
  /** 可执行文件路径（默认 process.execPath） */
  execPath?: string;
}

/**
 * 当前是否运行于「安装版副本」——由安装包安装到系统位置的可执行文件。
 *
 * 仅此形态具备写系统登录项（开机自启）的资格：免安装副本与安装版共用同一个
 * AppUserModelId 与 userData，一旦允许它写启动项就会相互覆盖（联调副本抢走安装版自启）。
 *
 * 判定依据构建期注入的仓库根目录：可执行文件是否落在**构建它的仓库目录内**。
 * - `pnpm build:unpack` 产物、`pnpm build:win` 遗留的 `dist/win-unpacked` 都在仓库内 → 拒绝
 * - 安装到 Program Files / Applications / /opt 的副本在仓库外 → 放行
 *
 * 不扫盘（不依赖卸载器文件名）、不读注册表，与构建目标无关，因此 `--skip-build`
 * 也不会出现风味串味；代价是构建机绝对路径会被内联进主进程 bundle（不含渲染层）。
 * 常量缺失时（如早期产物）按安装版放行，避免把正常用户锁死。
 */
export function isInstalledCopy(options: InstalledCopyOptions = {}): boolean {
  if (!(options.packaged ?? isPackaged)) return false;

  const repoRoot = options.repoRoot ?? BUILD_REPO_ROOT;
  if (!repoRoot) return true;

  const exePath = path.resolve(options.execPath ?? process.execPath);
  const relative = path.relative(path.resolve(repoRoot), exePath);
  // 只把「父目录本身」或「以 ..+分隔符开头的父级路径」视为仓库外；
  // 不能简单用 startsWith('..')，否则仓库内名为 `..dist` 的目录会被误判为外部并放开自启写入
  return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

/**
 * 获取当前权威运行环境语义 ('development' | 'production' | 'test')
 */
export function getAppEnv(): AppEnv {
  if (isTest) {
    return APP_ENV.TEST;
  }
  if (isDev) {
    return APP_ENV.DEVELOPMENT;
  }
  return APP_ENV.PRODUCTION;
}

export const currentAppEnv: AppEnv = getAppEnv();

/**
 * 本地开发服务器 URL (若存在且严格处于开发态)
 */
export const devServerUrl: string | undefined =
  process.env.MODE === 'development' && process.env.VITE_DEV_SERVER_URL
    ? process.env.VITE_DEV_SERVER_URL
    : undefined;

/**
 * 打包态在入口最早期将构建期白名单默认值（ELECTRON_APP_*）内存回填至 process.env：
 * - 仅在 process.env[key] === undefined 时写入，外部注入（含显式空字符串）始终优先
 * - 保证 dev 与 packed 下所有业务代码统一通过 process.env.ELECTRON_APP_* ?? ... 读取
 */
export function hydrateBundledRuntimeEnv(
  defaults: Partial<Record<RuntimeEnvKey, string>> | undefined = typeof __BUNDLED_RUNTIME_ENV__ !==
  'undefined'
    ? __BUNDLED_RUNTIME_ENV__
    : undefined,
): void {
  if (!defaults) return;
  for (const key of RUNTIME_ENV_KEYS) {
    const value = defaults[key];
    if (process.env[key] === undefined && value !== undefined) {
      process.env[key] = value;
    }
  }
}

hydrateBundledRuntimeEnv();

/**
 * 编译期从根 package.json 的 repository.url 解析出的 GitHub 发布源坐标
 *
 * 未打包形态（preview）下 electron-updater 需要显式 setFeedURL；
 * 该坐标属于仓库身份，随代码走，不再支持 .env 覆盖。
 */
export const bundledRepository = {
  owner: typeof __GITHUB_OWNER__ !== 'undefined' ? __GITHUB_OWNER__ : '',
  repo: typeof __GITHUB_REPO__ !== 'undefined' ? __GITHUB_REPO__ : '',
} as const;

/**
 * 获取注入给渲染进程的全局只读运行时环境基座快照
 */
export function getRuntimeEnvSnapshot(): AppRuntimeEnv {
  if (!app.isReady()) {
    throw new Error('Cannot get runtime env snapshot before app is ready.');
  }

  return {
    mode: currentAppEnv,
    appVersion: app.getVersion(),
    appName: app.getName(),
    channel: process.env.ELECTRON_APP_DISTRIBUTION_CHANNEL || undefined,
    apiBaseUrl: process.env.ELECTRON_APP_API_BASE_URL || undefined,
    systemCode: process.env.ELECTRON_APP_SYSTEM_CODE || undefined,
    sentryDsn: process.env.ELECTRON_APP_SENTRY_DSN || undefined,
    releaseName: typeof __RELEASE_NAME__ !== 'undefined' ? __RELEASE_NAME__ : undefined,
  };
}

/**
 * 将运行时环境快照序列化为命令行启动参数（压缩混淆形式）
 */
export function getPackedEnvArgument(env: AppRuntimeEnv = getRuntimeEnvSnapshot()): string {
  return `${APP_ENV_ARG_PREFIX}${packRuntimeEnv(env)}`;
}
