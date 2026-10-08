import { APP_ENV, type AppEnv } from '@app/shared/constants/env';

/**
 * 渲染进程运行环境门面 (Vite Static Replacement)
 * 统一收敛渲染进程中的环境判定
 */
export const isDev: boolean = import.meta.env.DEV;
export const isProd: boolean = import.meta.env.PROD;
export const currentAppEnv: AppEnv = isDev ? APP_ENV.DEVELOPMENT : APP_ENV.PRODUCTION;
