import fs from 'node:fs';
import path from 'node:path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import dotenv from 'dotenv';
import { defineConfig } from 'vite';
import { getSentryBuildConfig } from '../../build/sentry-config.ts';

const sentryConfig = getSentryBuildConfig(__dirname);
const rootDir = sentryConfig.rootDir;
const envPath = path.resolve(rootDir, '.env');
const envConfig = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath, 'utf8')) : {};
const prefix = envConfig.ENV_PREFIX || 'APP_';

export default defineConfig({
  define: {
    __ENV_PREFIX__: JSON.stringify(prefix),
    __APP_VERSION__: JSON.stringify(sentryConfig.appVersion),
    __SENTRY_DSN__: JSON.stringify(sentryConfig.sentryDsn),
    __RELEASE_NAME__: JSON.stringify(sentryConfig.releaseName),
    __ENV_DEFAULTS__: JSON.stringify(envConfig),
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
      external: ['electron', 'electron-updater', 'electron-log'],
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
