import { readAppIdentity } from './app-identity';
import { getRepoEnvValue, loadRepoEnv } from './env';

export interface SentryBuildConfig {
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
 * 构建期基础设施模块：环境由 build/env.ts 单点加载，身份由 build/app-identity.ts 单点解析。
 */
export function getSentryBuildConfig(fromDir: string): SentryBuildConfig {
  const env = loadRepoEnv(fromDir, 'production');
  const identity = readAppIdentity(env.rootDir);
  const value = (key: string): string => getRepoEnvValue(env, key);

  return {
    rootDir: env.rootDir,
    appName: identity.name,
    appVersion: identity.version,
    releaseName: `${identity.name}@${identity.version}`,
    sentryDsn: value('SENTRY_DSN'),
    sentryOrg: value('SENTRY_ORG'),
    sentryProject: value('SENTRY_PROJECT'),
    sentryAuthToken: value('SENTRY_AUTH_TOKEN'),
  };
}
