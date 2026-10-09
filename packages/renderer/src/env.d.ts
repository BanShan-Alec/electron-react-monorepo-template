/// <reference types="vite/client" />

import type { AppRuntimeEnv } from '@app/shared/types/env';
import type { ElectronApi } from '@shared/types/api';

declare global {
  /** vite.config.ts define 注入的应用版本（根 package.json 的 version） */
  const __APP_VERSION__: string;

  /** HTML 脚本动态注入的全局只读运行时环境基座 */
  const __APP_ENV__: AppRuntimeEnv;

  interface Window {
    readonly api: ElectronApi;
    readonly __APP_ENV__: AppRuntimeEnv;
  }
}

declare module '*.po' {
  import type { Messages } from '@lingui/core';
  export const messages: Messages;
}
