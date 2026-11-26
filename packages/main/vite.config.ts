import fs from 'node:fs';
import path from 'node:path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';
import { APP_IDENTITY } from '../../build/lib/app-identity.ts';
import { getRepoEnvValue, loadRepoEnv } from '../../build/lib/env.ts';
import { getSentryBuildOptions } from '../../build/lib/sentry-options.ts';
import { RUNTIME_ENV_KEYS, type RuntimeEnvKey } from '../shared/src/constants/env.ts';

const repoEnv = loadRepoEnv(__dirname, 'production');
const sentryOptions = getSentryBuildOptions(__dirname);
const isDev = process.env.MODE === 'development';

// 仅打包带 ELECTRON_APP_ 前缀的运行时白名单默认值，入口启动时内存回填至 process.env
const bundledRuntimeEnv = RUNTIME_ENV_KEYS.reduce(
  (acc, key) => {
    acc[key] = getRepoEnvValue(repoEnv, key);
    return acc;
  },
  {} as Record<RuntimeEnvKey, string>,
);

const pkgPath = path.resolve(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const runtimeDependencies = Object.keys(pkg.dependencies ?? {});

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(sentryOptions.appVersion),
    __RELEASE_NAME__: JSON.stringify(sentryOptions.releaseName),
    __GITHUB_OWNER__: JSON.stringify(APP_IDENTITY.repositoryOwner),
    __GITHUB_REPO__: JSON.stringify(APP_IDENTITY.repositoryName),
    // 仅注入主进程 bundle：用于判定可执行文件是否落在构建时的仓库目录内（免安装副本识别）
    __BUILD_REPO_ROOT__: JSON.stringify(repoEnv.rootDir),
    __BUNDLED_RUNTIME_ENV__: JSON.stringify(bundledRuntimeEnv),
  },
  plugins: [
    sentryVitePlugin({
      org: sentryOptions.sentryOrg,
      project: sentryOptions.sentryProject,
      authToken: sentryOptions.sentryAuthToken,
      telemetry: false,
      disable: !sentryOptions.sentryAuthToken,
      release: {
        name: sentryOptions.releaseName,
      },
      sourcemaps: {
        filesToDeleteAfterUpload: ['dist/**/*.map'],
      },
    }),
  ],
  build: {
    // 与 packages/preload/vite.config.ts 保持同一套构建默认值，改动时两边同步
    ssr: true,
    sourcemap: isDev ? 'inline' : 'hidden',
    minify: isDev ? false : 'oxc',
    outDir: 'dist',
    assetsDir: '.',
    target: 'node24',
    lib: {
      entry: 'src/index.ts',
      formats: ['cjs'],
    },
    rolldownOptions: {
      // 自动从 package.json 的 dependencies 提取运行时依赖设为 external（外加 electron）
      // 需要内联打进 bundle 的纯 JS 依赖（如 electron-log、zod）装在 devDependencies
      external: ['electron', ...runtimeDependencies],
      output: {
        entryFileNames: '[name].cjs',
        format: 'cjs',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  ssr: {
    // 除 external 列表外全部内联；electron-log 通过此策略进入 bundle
    noExternal: true,
  },
});
