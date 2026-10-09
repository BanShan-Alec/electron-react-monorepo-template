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
    (typeof __SENTRY_DSN__ !== 'undefined' && __SENTRY_DSN__ ? __SENTRY_DSN__ : '') ||
    import.meta.env.VITE_SENTRY_DSN ||
    '';

  // 严格守卫：仅打包后且有有效 DSN 时激活
  const isEnabled = import.meta.env.PROD && Boolean(dsn);

  if (!isEnabled) {
    return;
  }

  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0';

  Sentry.init({
    dsn,
    enabled: true,
    environment: 'production',
    release: `electron-react-monorepo-template@${appVersion}`,

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
