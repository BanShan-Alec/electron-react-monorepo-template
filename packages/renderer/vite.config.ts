import { readFileSync } from 'node:fs';
import path from 'node:path';
import { lingui } from '@lingui/vite-plugin';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import { startupShellInlinePlugin } from './plugins/startup-shell';
import tailwindConfig from './tailwind.config.ts';

// 版本单一事实源 = 根 package.json：构建期 define 注入 renderer，UI 徽章不再硬编码
const appVersion = (
  JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8')) as {
    version: string;
  }
).version;

// https://vite.dev/config/
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
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
