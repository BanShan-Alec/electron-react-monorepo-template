import type { AppEnv } from '../constants/env';

export type { AppEnv };

export interface EnvFlags {
  readonly isDev: boolean;
  readonly isProd: boolean;
  readonly isTest: boolean;
  readonly isPackaged: boolean;
  readonly env: AppEnv;
}
