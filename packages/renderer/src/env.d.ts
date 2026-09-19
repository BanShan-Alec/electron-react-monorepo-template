/// <reference types="vite/client" />

import type { ElectronApi } from '@app/shared';

declare global {
  interface Window {
    readonly api: ElectronApi;
  }
}
