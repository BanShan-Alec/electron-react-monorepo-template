import { APP_IDENTITY } from './app-identity';
import { ensureRepoEnv } from './env';

export interface SentryBuildOptions {
  rootDir: string;
  appName: string;
  appVersion: string;
  releaseName: string;
  sentryDsn: string;
  sentryOrg: string;
  sentryProject: string;
  sentryAuthToken: string;
}

/**
 * 统一解析根目录 package.json 身份与 .env 中的 Sentry 构建期配置
 *
 * 构建期基础设施模块：环境由 build/lib/env.ts 单点幂等注入 process.env，身份由 build/lib/app-identity.ts 单点解析。
 */
export function getSentryBuildOptions(fromDir: string): SentryBuildOptions {
  const rootDir = ensureRepoEnv(fromDir, 'production');

  return {
    rootDir,
    appName: APP_IDENTITY.name,
    appVersion: APP_IDENTITY.version,
    releaseName: `${APP_IDENTITY.name}@${APP_IDENTITY.version}`,
    sentryDsn: process.env.EL_SENTRY_DSN ?? '',
    sentryOrg: process.env.SENTRY_ORG ?? '',
    sentryProject: process.env.SENTRY_PROJECT ?? '',
    sentryAuthToken: process.env.SENTRY_AUTH_TOKEN ?? '',
  };
}
