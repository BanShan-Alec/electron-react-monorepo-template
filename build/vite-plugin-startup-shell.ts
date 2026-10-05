import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { build, normalizePath } from 'vite';

/**
 * 启动壳构建期内联插件 (specs/first-screen-loading.md §4.7 / ADR-0002)
 *
 * dev 与 build 走同一 transformIndexHtml，替换两个占位符：
 * - `<!-- __APP_STARTUP_LOGO__ -->` ← src/assets/logo.svg 文件原文（剥 XML 声明与注释）
 * - `<!-- __APP_STARTUP_COORDINATOR__ -->` ← src/startup/coordinator.ts 打包的经典 IIFE
 *   内联 `<script>`（含其 import 的 @app/shared 纯常量），物理位置先于 main.tsx。
 *
 * 工具链红线（D10 / CONTRIBUTING §一.5）：仅用 Vite 8 / Rolldown / Oxc 原生能力。
 * transformWithOxc 为单文件转译、不打包 import，故协调器用程序化 build() 内存打包：
 * configFile:false + write:false + format:'iife'，零新增依赖。
 *
 * fail-fast：占位符缺失、打包失败即抛错终止——壳是首屏生命线，静默降级等于白屏。
 */

// 私有常量
const LOGO_PLACEHOLDER = '<!-- __APP_STARTUP_LOGO__ -->';
const COORDINATOR_PLACEHOLDER = '<!-- __APP_STARTUP_COORDINATOR__ -->';

export interface StartupShellInlinePluginOptions {
  /** renderer 包根目录（vite.config 里传 __dirname），用于定位壳源码资产 */
  root: string;
}

export function startupShellInlinePlugin(options: StartupShellInlinePluginOptions): Plugin {
  const { root } = options;
  const indexEntry = normalizePath(path.resolve(root, 'index.html'));
  const coordinatorEntry = path.resolve(root, 'src/startup/coordinator.ts');
  const sharedStartupConstants = path.resolve(
    root,
    '../../packages/shared/src/constants/startup.ts',
  );
  const logoFile = path.resolve(root, 'src/assets/logo.svg');

  // 可抽离的逻辑处理函数/组件

  const statMtime = (file: string): number => {
    try {
      return fs.statSync(file).mtimeMs;
    } catch {
      return -1;
    }
  };

  const readLogoMarkup = (() => {
    let cacheKey = '';
    let cacheValue = '';
    return (): string => {
      const key = String(statMtime(logoFile));
      if (key !== cacheKey) {
        // 剥除 XML 声明与注释后原文内联；素材替换只改文件，HTML 零改动
        cacheValue = fs
          .readFileSync(logoFile, 'utf-8')
          .replace(/<\?xml[^>]*\?>/g, '')
          .replace(/<!--[\s\S]*?-->/g, '')
          .trim();
        cacheKey = key;
      }
      return cacheValue;
    };
  })();

  const bundleCoordinator = (() => {
    let cacheKey = '';
    let cacheValue = '';
    return async (): Promise<string> => {
      const key = `${statMtime(coordinatorEntry)}|${statMtime(sharedStartupConstants)}`;
      if (key === cacheKey) {
        return cacheValue;
      }

      // 程序化内存打包：空插件管线 + rolldown 原生 TS 转译；@app/shared 经
      // renderer 的 node_modules symlink 以裸 TS subpath exports 解析
      const result = await build({
        configFile: false,
        logLevel: 'silent',
        root,
        plugins: [],
        build: {
          write: false,
          minify: false,
          rollupOptions: {
            input: coordinatorEntry,
            output: {
              format: 'iife',
            },
          },
        },
      });

      const bundle = Array.isArray(result) ? result[0] : result;
      if (!('output' in bundle)) {
        throw new Error('[startup-shell] 内存打包未返回产物，请检查 rollupOptions 配置');
      }
      const chunk = bundle.output.find((item) => item.type === 'chunk');
      if (!chunk) {
        throw new Error('[startup-shell] 内存打包产物中没有 chunk');
      }

      cacheValue = `<script>\n${chunk.code.trim()}\n</script>`;
      cacheKey = key;
      return cacheValue;
    };
  })();

  return {
    name: 'app-startup-shell-inline',
    enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      async handler(html, ctx) {
        // 入口隔离（spec §6.7）：仅主入口接壳；updater.html 等其它 html 原样放行。
        // build 模式 ctx.filename 经 vite normalizePath 为正斜杠，两侧必须归一后比较
        const isMainEntry = ctx.filename === indexEntry;
        if (!isMainEntry) {
          return html;
        }

        if (!html.includes(LOGO_PLACEHOLDER) || !html.includes(COORDINATOR_PLACEHOLDER)) {
          throw new Error(
            '[startup-shell] index.html 缺少启动壳占位符，契约见 specs/first-screen-loading.md §4.2',
          );
        }

        const [logoMarkup, coordinatorScript] = [readLogoMarkup(), await bundleCoordinator()];
        const replaced = html
          .replace(LOGO_PLACEHOLDER, logoMarkup)
          .replace(COORDINATOR_PLACEHOLDER, coordinatorScript);

        if (replaced.includes(LOGO_PLACEHOLDER) || replaced.includes(COORDINATOR_PLACEHOLDER)) {
          throw new Error('[startup-shell] 占位符替换未完成，请检查插件替换逻辑');
        }
        return replaced;
      },
    },
  };
}
