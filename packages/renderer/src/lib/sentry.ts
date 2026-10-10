import { APP_ENV } from '@app/shared/constants/env';
import * as Sentry from '@sentry/electron/renderer';

/**
 * 生产级 Sentry 渲染进程配置
 * 1. 严格仅在生产打包环境（PROD）且有效 DSN 时激活上报，开发阶段零网络开销与侵入
 * 2. 仅开启致命异常监控（window.onerror / unhandledrejection / React 组件崩溃）
 * 3. 彻底禁用行为监控（Breadcrumbs / DOM / Console / Net 轨迹），保护隐私与性能
 * 4. 彻底禁用性能追踪（Tracing / Profiling），采样率为 0
 */
export function initSentry(): void {
  const dsn =
    import.meta.env.SENTRY_DSN ||
    import.meta.env.VITE_SENTRY_DSN ||
    (typeof __SENTRY_DSN__ !== 'undefined' ? __SENTRY_DSN__ : '');

  // 基于 window.__APP_ENV__?.mode 判断是否为生产模式 (兜底 import.meta.env.PROD)
  const isProd =
    typeof window !== 'undefined' && window.__APP_ENV__?.mode
      ? window.__APP_ENV__.mode === APP_ENV.PRODUCTION
      : import.meta.env.PROD;

  // 严格守卫：仅 prod 模式且有有效 DSN 时激活
  const isEnabled = isProd && Boolean(dsn);

  if (!isEnabled) {
    return;
  }

  const appVersion =
    import.meta.env.APP_VERSION ||
    (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown');
  const release = import.meta.env.RELEASE_NAME || `electron-react-monorepo-template@${appVersion}`;

  Sentry.init({
    dsn,
    enabled: true,
    environment: 'production',
    release,

    // 彻底关闭行为监控（Breadcrumbs）
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    integrations: (defaults) => defaults.filter((i) => !i.name.includes('Breadcrumb')),

    // 彻底关闭性能监控（Tracing）
    tracesSampleRate: 0,

    // 过滤常见前端非致命噪声
    ignoreErrors: [
      'ResizeObserver loop completed with undelivered notifications',
      'ResizeObserver loop limit exceeded',
      'Network Error',
      'Failed to fetch',
      'Load failed',
    ],
  });
}

export { Sentry };
