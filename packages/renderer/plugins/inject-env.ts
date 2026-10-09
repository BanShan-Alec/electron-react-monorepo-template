import type { AppEnv } from '@app/shared/constants/env';
import type { AppRuntimeEnv } from '@app/shared/types/env';
import type { Plugin } from 'vite';

const ENV_PLACEHOLDER = '<!-- __APP_ENV_INJECTION__ -->';

export interface InjectAppEnvPluginOptions {
  appVersion: string;
}

/**
 * 运行时环境占位符注入插件
 *
 * - 开发环境 (serve)：由 Vite Dev Server 拦截 HTML 请求，将占位符替换为当前环境变量
 * - 生产构建 (build)：保留占位符原样输出到 dist/*.html，由主进程特权自定义协议 (app://) 在运行时动态替换
 */
export function injectAppEnvPlugin(options: InjectAppEnvPluginOptions): Plugin {
  const { appVersion } = options;

  return {
    name: 'vite-plugin-inject-app-env',
    transformIndexHtml(html, ctx) {
      if (!html.includes(ENV_PLACEHOLDER)) {
        return html;
      }

      // 仅在开发服务器 (serve) 模式下直接内联开发态环境变量
      if (ctx.server) {
        const mode = (process.env.MODE as AppEnv) || 'development';
        const runtimeEnv: AppRuntimeEnv = {
          mode,
          appVersion,
          appName: 'electron-react-monorepo-template',
          channel: process.env.VITE_DISTRIBUTION_CHANNEL,
          apiBaseUrl: process.env.VITE_API_BASE_URL,
          systemCode: process.env.VITE_SYSTEM_CODE,
        };
        const script = `<script>window.__APP_ENV__=Object.freeze(${JSON.stringify(runtimeEnv)});</script>`;
        return html.replace(ENV_PLACEHOLDER, script);
      }

      // 生产构建时保留占位符，供主进程 protocol.handle 运行时动态插桩
      return html;
    },
  };
}
