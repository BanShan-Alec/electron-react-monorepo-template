/// <reference types="vite/client" />

import type { ElectronApi } from '@shared/types/api';

declare global {
  interface Window {
    readonly api: ElectronApi;
  }
}

declare module '*.po' {
  import type { Messages } from '@lingui/core';
  export const messages: Messages;
}
