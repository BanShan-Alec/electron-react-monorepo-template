import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig, loadEnv } from 'vite';
import { getSentryBuildConfig } from '../../build/sentry-config.ts';

const sentryConfig = getSentryBuildConfig(__dirname);
const rootDir = sentryConfig.rootDir;
const mode = process.env.MODE || 'production';
const envConfig = loadEnv(mode, rootDir, '');
const prefix = envConfig.ENV_PREFIX || 'APP_';

// 严格白名单过滤：仅暴露业务需要的默认配置，杜绝全量泄露风险
const ALLOWED_ENV_KEYS = [
  'API_BASE_URL',
  'SYSTEM_CODE',
  'DISTRIBUTION_CHANNEL',
  'SENTRY_DSN',
  'GITHUB_OWNER',
  'GITHUB_REPO',
] as const;

const envDefaults = ALLOWED_ENV_KEYS.reduce(
  (acc, key) => {
    acc[key] = envConfig[key] || '';
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
    ssr: true,
    sourcemap: process.env.MODE === 'development' ? 'inline' : 'hidden',
    minify: process.env.MODE === 'development' ? false : 'oxc',
    outDir: 'dist',
    assetsDir: '.',
    target: 'node22',
    lib: {
      entry: 'src/index.ts',
      formats: ['cjs'],
    },
    rolldownOptions: {
      external: ['electron', 'electron-updater', 'electron-log', 'usb'],
      output: {
        entryFileNames: '[name].cjs',
        format: 'cjs',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  ssr: {
    noExternal: ['zod', /^@sentry\/.*/],
  },
});
