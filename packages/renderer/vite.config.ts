import path from 'node:path';
import { lingui } from '@lingui/vite-plugin';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import { getSentryBuildConfig } from '../../build/sentry-config.ts';
import { startupShellInlinePlugin } from './plugins/startup-shell.ts';
import tailwindConfig from './tailwind.config.ts';

const currentDir = import.meta.dirname;
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
    // 开发态根路径自动重定向至 home 窗口入口，便于浏览器直接访问 dev server
    {
      name: 'html-entry-redirect',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/' || req.url === '/index.html') {
            req.url = '/src/entries/home/index.html';
          }
          next();
        });
      },
    },
    // 启动壳占位符内联（dev/build 同一形态），契约见 specs/first-screen-loading.md §4.7
    startupShellInlinePlugin({ root: currentDir }),
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
        home: path.resolve(currentDir, 'src/entries/home/index.html'),
        updater: path.resolve(currentDir, 'src/entries/updater/index.html'),
      },
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 1. 最稳定核心运行时：React 系列
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            // 2. UI 框架：Ant Design 及其样式/图标/底层 RC 库
            if (id.includes('antd') || id.includes('@ant-design') || id.includes('rc-')) {
              return 'vendor-antd';
            }
          }
        },
      },
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss(tailwindConfig), autoprefixer()],
    },
  },
});
