import { APP_ENV, type AppEnv } from '@app/shared/constants/env';
import { app } from 'electron';

/**
 * 是否处于自动化测试环境 (Playwright / Vitest)
 * 由测试启动器注入 MODE=test
 */
export const isTest: boolean = process.env.MODE === 'test';

/**
 * 是否处于已打包二进制分发形态 (.exe / .app / AppImage)
 * Electron 官方权威判定，打包后二进制恒为 true
 */
export const isPackaged: boolean = app.isPackaged;

/**
 * 是否处于本地开发态
 * 判定原则：未打包 + 非测试模式 + MODE 未显式指定为 production
 */
export const isDev: boolean = !isPackaged && !isTest && process.env.MODE !== 'production';

/**
 * 是否处于生产行为态
 * 判定原则：非测试模式，且已打包或 MODE 显式为 production（例如 start:dist 预览）
 */
export const isProd: boolean = !isTest && (isPackaged || process.env.MODE === 'production');

/**
 * 获取当前权威运行环境语义 ('development' | 'production' | 'test')
 */
export function getAppEnv(): AppEnv {
  if (isTest) {
    return APP_ENV.TEST;
  }
  if (isDev) {
    return APP_ENV.DEVELOPMENT;
  }
  return APP_ENV.PRODUCTION;
}

export const currentAppEnv: AppEnv = getAppEnv();

/**
 * 本地开发服务器 URL (若存在且严格处于开发态)
 */
export const devServerUrl: string | undefined =
  process.env.MODE === 'development' && process.env.VITE_DEV_SERVER_URL
    ? process.env.VITE_DEV_SERVER_URL
    : undefined;

/**
 * 获取注入给渲染进程的全局只读运行时环境基座快照
 */
export function getRuntimeEnvSnapshot(): import('@app/shared/types/env').AppRuntimeEnv {
  return {
    mode: currentAppEnv,
    appVersion: app.isReady() ? app.getVersion() : process.env.npm_package_version || '1.0.0',
    appName: app.isReady() ? app.getName() : 'Electron App',
    channel: process.env.VITE_DISTRIBUTION_CHANNEL,
    apiBaseUrl: process.env.VITE_API_BASE_URL,
    systemCode: process.env.VITE_SYSTEM_CODE,
  };
}

/**
 * 将运行时环境快照序列化为深度冻结的内联 HTML 脚本标签
 */
export function serializeRuntimeEnvScript(
  env: import('@app/shared/types/env').AppRuntimeEnv = getRuntimeEnvSnapshot(),
): string {
  return `<script>window.__APP_ENV__=Object.freeze(${JSON.stringify(env)});</script>`;
}
