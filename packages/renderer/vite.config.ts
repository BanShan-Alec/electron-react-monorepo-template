import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lingui } from '@lingui/vite-plugin';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import { injectAppEnvPlugin } from './plugins/inject-env.ts';
import { startupShellInlinePlugin } from './plugins/startup-shell.ts';
import tailwindConfig from './tailwind.config.ts';

const require = createRequire(import.meta.url);
const { getSentryBuildConfig } = require('../../build/sentry-config.ts');

const currentDir =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const sentryConfig = getSentryBuildConfig(currentDir);

// https://vite.dev/config/
export default defineConfig({
  // 环境变量单一事实源：Monorepo 全局统一定义在根目录 .env，子包不设独立 .env
  envDir: sentryConfig.rootDir,
  base: './',
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(sentryConfig.appVersion),
    'import.meta.env.SENTRY_DSN': JSON.stringify(sentryConfig.sentryDsn),
    'import.meta.env.RELEASE_NAME': JSON.stringify(sentryConfig.releaseName),
    __APP_VERSION__: JSON.stringify(sentryConfig.appVersion),
    __SENTRY_DSN__: JSON.stringify(sentryConfig.sentryDsn),
  },
  plugins: [
    react(),
    lingui({
      configPath: path.resolve(currentDir, 'lingui.config.ts'),
      cwd: currentDir,
      macroTransform: true,
    }),
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
    // 启动壳占位符内联（dev/build 同一形态），契约见 specs/first-screen-loading.md §4.7
    startupShellInlinePlugin({ root: currentDir }),
    // 运行时环境基座动态注入 (HTML Head Inlining)
    injectAppEnvPlugin({
      appVersion: sentryConfig.appVersion,
      appName: sentryConfig.appName,
    }),
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
        main: path.resolve(currentDir, 'index.html'),
        updater: path.resolve(currentDir, 'updater.html'),
      },
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss(tailwindConfig), autoprefixer()],
    },
  },
});
