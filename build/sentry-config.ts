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

  // 优先从环境变量读取；若环境变量未注入，则兜底从根目录 .env 文件解析
  const envFileConfig: Record<string, string> = {};
  const envFilePath = path.join(rootDir, '.env');
  try {
    const envContent = readFileSync(envFilePath, 'utf-8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        envFileConfig[match[1].trim()] = match[2].trim();
      }
    }
  } catch {
    // 忽略 .env 文件不存在或读取异常
  }

  const sentryDsn = process.env.SENTRY_DSN || envFileConfig.SENTRY_DSN || '';
  const sentryOrg = process.env.SENTRY_ORG || envFileConfig.SENTRY_ORG || '';
  const sentryProject = process.env.SENTRY_PROJECT || envFileConfig.SENTRY_PROJECT || '';
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN || envFileConfig.SENTRY_AUTH_TOKEN || '';

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
