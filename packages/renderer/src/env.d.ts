/// <reference types="vite/client" />

import type { AppRuntimeEnv } from '@app/shared/types/env';
import type { ElectronApi } from '@shared/types/api';

declare global {
  /** Preload 通过 additionalArguments 同步解包注入的全局只读运行时环境基座 */
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
