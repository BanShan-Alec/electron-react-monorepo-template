import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';
import { APP_IDENTITY } from '../../build/app-identity.ts';
import { getRepoEnvValue, loadRepoEnv } from '../../build/env.ts';
import { getSentryBuildConfig } from '../../build/sentry-config.ts';

const repoEnv = loadRepoEnv(__dirname, 'production');
const sentryConfig = getSentryBuildConfig(__dirname);
const prefix = getRepoEnvValue(repoEnv, 'ENV_PREFIX') || 'APP_';
const isDev = process.env.MODE === 'development';

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
  build: {
    // 与 packages/preload/vite.config.ts 保持同一套构建默认值，改动时两边同步
    ssr: true,
    sourcemap: isDev ? 'inline' : 'hidden',
    minify: isDev ? false : 'oxc',
    outDir: 'dist',
    assetsDir: '.',
    target: 'node24',
    lib: {
      entry: 'src/index.ts',
      formats: ['cjs'],
    },
    rolldownOptions: {
      // 精确匹配：electron-log/main 故意不在列表，由 noExternal: true 内联。
      // 新增必须在运行时 require 的依赖时，务必把实际 specifier（含子路径）加到这里。
      external: ['electron', 'usb', 'electron-updater'],
      output: {
        entryFileNames: '[name].cjs',
        format: 'cjs',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  ssr: {
    // 除 external 列表外全部内联；electron-log 通过此策略进入 bundle
    noExternal: true,
  },
});
