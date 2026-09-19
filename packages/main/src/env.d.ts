/// <reference types="vite/client" />

/**
 * Describes all existing environment variables and their types for Main Process.
 */
interface ImportMetaEnv {
  /**
   * URL where `renderer` web page is running in dev mode.
   */
  readonly VITE_DEV_SERVER_URL: undefined | string;

  /** Current app version */
  readonly VITE_APP_VERSION: string;

  /** Distribution channel for auto update */
  readonly VITE_DISTRIBUTION_CHANNEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
