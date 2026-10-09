const { sentryVitePlugin } = require('@sentry/vite-plugin');
const { defineConfig } = require('vite');
const { getSentryBuildConfig } = require('../../build/sentry-config.ts');

const sentryConfig = getSentryBuildConfig(__dirname);

module.exports = defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(sentryConfig.appVersion),
    __SENTRY_DSN__: JSON.stringify(sentryConfig.sentryDsn),
    __RELEASE_NAME__: JSON.stringify(sentryConfig.releaseName),
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
