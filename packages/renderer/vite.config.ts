import path from 'node:path';
import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin';
import babel from '@rolldown/plugin-babel';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import tailwindConfig from './tailwind.config.ts';

const linguiConfigOpts = {
  configPath: path.resolve(__dirname, 'lingui.config.ts'),
  cwd: __dirname,
};

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    lingui(linguiConfigOpts),
    babel({
      include: [/\.[jt]sx?$/],
      exclude: [/node_modules/],
      presets: [linguiTransformerBabelPreset({}, linguiConfigOpts)],
    }),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG || '',
      project: process.env.SENTRY_PROJECT || '',
      authToken: process.env.SENTRY_AUTH_TOKEN || '',
      telemetry: false,
      disable: !process.env.SENTRY_AUTH_TOKEN,
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
  },
  css: {
    postcss: {
      plugins: [tailwindcss(tailwindConfig), autoprefixer()],
    },
  },
});
