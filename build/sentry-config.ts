import { readFileSync } from 'node:fs';
import path from 'node:path';

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
 * 统一解析根目录 package.json 与 .env 中的 Sentry 构建期配置
 * 构建期基础设施模块，服务于各进程打包编译
 */
export function getSentryBuildConfig(fromDir?: string): SentryBuildConfig {
  const rootDir = fromDir ? path.resolve(fromDir, '../../') : path.resolve(process.cwd());
  const rootPkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  const appName: string = rootPkg.name || 'electron-app';
  const appVersion: string = rootPkg.version || '1.0.0';
  const releaseName = `${appName}@${appVersion}`;

  const sentryDsn = process.env.SENTRY_DSN || '';
  const sentryOrg = process.env.SENTRY_ORG || '';
  const sentryProject = process.env.SENTRY_PROJECT || '';
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN || '';

  return {
    rootDir,
    appName,
    appVersion,
    releaseName,
    sentryDsn,
    sentryOrg,
    sentryProject,
    sentryAuthToken,
  };
}
