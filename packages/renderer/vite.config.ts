import path from 'node:path';
import { lingui } from '@lingui/vite-plugin';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { readAppIdentity } from '../../build/app-identity.ts';
import { findRepoRoot } from '../../build/repo-paths.ts';
import { getSentryBuildConfig } from '../../build/sentry-config.ts';
import { appTitlePlugin } from './plugins/app-title.ts';
import { startupShellInlinePlugin } from './plugins/startup-shell.ts';

const currentDir = import.meta.dirname;
const rootDir = findRepoRoot(currentDir);
const sentryConfig = getSentryBuildConfig(currentDir);

// 窗口标题单一事实源：根 package.json 的 productName（与打包命名、托盘、Header 同源）
const appIdentity = readAppIdentity(rootDir);

// https://vite.dev/config/
export default defineConfig({
  // 环境变量单一事实源：Monorepo 全局统一定义在根目录 .env，子包不设独立 .env
  envDir: rootDir,
  base: './',
  // 运行时环境单一事实源：由 Preload 通过 additionalArguments 注入至 window.__APP_ENV__，前端不走编译期 define
  plugins: [
    tailwindcss(),
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
    // 窗口标题占位符注入（dev/build 同一形态）：两入口 <title> 统一取根 productName
    appTitlePlugin({ root: currentDir, appName: appIdentity.productName }),
    // 启动壳占位符内联（dev/build 同一形态），契约见 specs/first-screen-loading.md §4.7
    startupShellInlinePlugin({ root: currentDir }),
  ],
  // 路径别名单一事实源：根 tsconfig.json + Vite 官方原生 tsconfigPaths（零插件）
  tsconfig: '../../tsconfig.json',
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    // port 从 scripts/dev.ts 的 config.rendererPort 注入
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
});
