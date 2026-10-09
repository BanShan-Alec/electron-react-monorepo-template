/// <reference types="vite/client" />

import type { ElectronApi } from '@shared/types/api';

declare global {
  /** vite.config.ts define 注入的应用版本（根 package.json 的 version） */
  const __APP_VERSION__: string;
  /** vite.config.ts define 注入的 Sentry DSN */
  const __SENTRY_DSN__: string;

  interface Window {
    readonly api: ElectronApi;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: Vite ImportMetaEnv augmentation
interface ImportMetaEnv {
  readonly APP_VERSION: string;
  readonly SENTRY_DSN: string;
  readonly VITE_SENTRY_DSN: string;
  readonly RELEASE_NAME: string;
}

declare module '*.po' {
  import type { Messages } from '@lingui/core';
  export const messages: Messages;
}
