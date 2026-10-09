import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { lingui } from '@lingui/vite-plugin';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import { startupShellInlinePlugin } from './plugins/startup-shell';
import tailwindConfig from './tailwind.config.ts';

const rootDir = path.resolve(import.meta.dirname, '../../');
const rootPkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const appVersion = rootPkg.version;

let sentryDsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN || '';
const envPath = path.join(rootDir, '.env');
if (!sentryDsn && existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8');
  const match = content.match(/^(?:SENTRY_DSN|VITE_SENTRY_DSN)\s*=\s*(.+)$/m);
  if (match) {
    sentryDsn = match[1].trim();
  }
}

// https://vite.dev/config/
export default defineConfig({
  envDir: rootDir,
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __SENTRY_DSN__: JSON.stringify(sentryDsn),
  },
  plugins: [
    react(),
    lingui({
      configPath: path.resolve(__dirname, 'lingui.config.ts'),
      cwd: __dirname,
      macroTransform: true,
    }),
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
    // 启动壳占位符内联（dev/build 同一形态），契约见 specs/first-screen-loading.md §4.7
    startupShellInlinePlugin({ root: __dirname }),
  ],
  // 路径别名单一事实源：根 tsconfig.json + Vite 官方原生 tsconfigPaths（零插件）
  tsconfig: '../../tsconfig.json',
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    // port 从 scripts/dev.ts 的 RENDERER_PORT 常量注入
    strictPort: true,
    host: true,
    hmr: {
      overlay: false,
    },
  },
  build: {
    // 使用 'hidden' 模式：仅生成 .map 文件供 Sentry 插件上传，不在 JS 产物末尾写入 sourceMappingURL 注释；
    // 配合 electron-builder 的 '!**/*.map' 排除规则，确保 SourceMap 绝不会被打包进 asar，彻底避免源码泄露
    sourcemap: 'hidden',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        updater: path.resolve(__dirname, 'updater.html'),
      },
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss(tailwindConfig), autoprefixer()],
    },
  },
});
