import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';
import { APP_IDENTITY } from '../../build/app-identity.ts';
import { getRepoEnvValue, loadRepoEnv } from '../../build/env.ts';
import { MAIN_EXTERNAL_MODULES } from '../../build/main-externals.ts';
import { getSentryBuildConfig } from '../../build/sentry-config.ts';
import { createNodeLibBuildOptions } from '../../build/vite-lib.ts';

const repoEnv = loadRepoEnv(__dirname, 'production');
const sentryConfig = getSentryBuildConfig(__dirname);
const prefix = getRepoEnvValue(repoEnv, 'ENV_PREFIX') || 'APP_';

// 严格白名单过滤：仅暴露业务需要的默认配置，杜绝全量泄露风险
const ALLOWED_ENV_KEYS = [
  'API_BASE_URL',
  'SYSTEM_CODE',
  'DISTRIBUTION_CHANNEL',
  'SENTRY_DSN',
] as const;

const envDefaults = ALLOWED_ENV_KEYS.reduce(
  (acc, key) => {
    acc[key] = getRepoEnvValue(repoEnv, key);
    return acc;
  },
  {} as Record<string, string>,
);

export default defineConfig({
  define: {
    __ENV_PREFIX__: JSON.stringify(prefix),
    __APP_VERSION__: JSON.stringify(sentryConfig.appVersion),
    __SENTRY_DSN__: JSON.stringify(sentryConfig.sentryDsn),
    __RELEASE_NAME__: JSON.stringify(sentryConfig.releaseName),
    __GITHUB_OWNER__: JSON.stringify(APP_IDENTITY.repositoryOwner),
    __GITHUB_REPO__: JSON.stringify(APP_IDENTITY.repositoryName),
    __ENV_DEFAULTS__: JSON.stringify(envDefaults),
  },
  plugins: [
    sentryVitePlugin({
      org: sentryConfig.sentryOrg,
      project: sentryConfig.sentryProject,
      authToken: sentryConfig.sentryAuthToken,
      telemetry: false,
      disable: !sentryConfig.sentryAuthToken,
      release: {
        name: sentryConfig.releaseName,
      },
      sourcemaps: {
        filesToDeleteAfterUpload: ['dist/**/*.map'],
      },
    }),
  ],
  build: createNodeLibBuildOptions({
    target: 'node24',
    external: MAIN_EXTERNAL_MODULES,
    entryFileNames: '[name].cjs',
  }),
  ssr: {
    noExternal: ['zod', /^@sentry\/.*/],
  },
});
