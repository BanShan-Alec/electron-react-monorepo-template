/// <reference types="vite/client" />

import type { RuntimeEnvKey } from '@app/shared/constants/env';

/**
 * Describes all existing environment variables and their types for Main Process.
 */
interface ImportMetaEnv {
  /**
   * URL where `renderer` web page is running in dev mode.
   */
  readonly VITE_DEV_SERVER_URL: undefined | string;
}

// biome-ignore lint/correctness/noUnusedVariables: Vite ImportMeta augmentation
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  const __APP_VERSION__: string;
  const __RELEASE_NAME__: string;
  /** 编译期从根 package.json 的 repository.url 解析出的 GitHub 发布源 owner */
  const __GITHUB_OWNER__: string;
  /** 编译期从根 package.json 的 repository.url 解析出的 GitHub 发布源 repo */
  const __GITHUB_REPO__: string;
  /** 编译期注入的仓库根目录（仅主进程），用于识别未安装到系统位置的就地副本 */
  const __BUILD_REPO_ROOT__: string;
  /** 编译期打包的 ELECTRON_APP_* 白名单默认值，启动期在入口内存回填至 process.env */
  const __BUNDLED_RUNTIME_ENV__: Partial<Record<RuntimeEnvKey, string>> | undefined;

  namespace NodeJS {
    interface ProcessEnv {
      ELECTRON_APP_API_BASE_URL?: string;
      ELECTRON_APP_SYSTEM_CODE?: string;
      ELECTRON_APP_DISTRIBUTION_CHANNEL?: string;
      ELECTRON_APP_SENTRY_DSN?: string;
    }
  }
}
