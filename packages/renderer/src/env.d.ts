/// <reference types="vite/client" />

import type { ElectronApi } from '@app/shared/types/api';

declare global {
  interface Window {
    readonly api: ElectronApi;
  }
}
