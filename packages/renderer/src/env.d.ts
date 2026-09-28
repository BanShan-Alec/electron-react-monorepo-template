/// <reference types="vite/client" />

import type { ElectronApi } from '@shared/types/api';

declare global {
  interface Window {
    readonly api: ElectronApi;
  }

  // CSS Custom Highlight API 支持
  class Highlight {
    constructor(...ranges: Range[]);
    add(range: Range): void;
    clear(): void;
    delete(range: Range): boolean;
    has(range: Range): boolean;
    readonly size: number;
  }

  interface HighlightRegistry extends Map<string, Highlight> {}

  namespace CSS {
    const highlights: HighlightRegistry;
  }
}

declare module '*.po' {
  import type { Messages } from '@lingui/core';
  export const messages: Messages;
}
