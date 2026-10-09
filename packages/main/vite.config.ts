import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';

const rootDir = path.resolve(import.meta.dirname, '../../');
const rootPkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const appVersion = rootPkg.version;

let sentryDsn = process.env.SENTRY_DSN || '';
const envPath = path.join(rootDir, '.env');
if (!sentryDsn && existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8');
  const match = content.match(/^SENTRY_DSN\s*=\s*(.+)$/m);
  if (match) {
    sentryDsn = match[1].trim();
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __SENTRY_DSN__: JSON.stringify(sentryDsn),
  },
  plugins: [
    sentryVitePlugin({
      org: process.env.SENTRY_ORG || '',
      project: process.env.SENTRY_PROJECT || '',
      authToken: process.env.SENTRY_AUTH_TOKEN || '',
      telemetry: false,
      disable: !process.env.SENTRY_AUTH_TOKEN,
      release: {
        name: `electron-react-monorepo-template@${appVersion}`,
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
