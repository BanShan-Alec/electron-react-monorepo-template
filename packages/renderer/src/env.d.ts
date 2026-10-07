/// <reference types="vite/client" />

import type { ElectronApi } from '@shared/types/api';

/** vite.config.ts define 注入的应用版本（根 package.json 的 version） */
declare const __APP_VERSION__: string;

declare global {
  interface Window {
    readonly api: ElectronApi;
  }
}

declare module '*.po' {
  import type { Messages } from '@lingui/core';
  export const messages: Messages;
}
