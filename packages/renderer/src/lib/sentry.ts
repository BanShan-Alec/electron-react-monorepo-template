import { APP_ENV } from '@app/shared/constants/env';
import * as Sentry from '@sentry/react';

/**
 * 生产级 Sentry 渲染进程配置（黄金配置模板）
 * 1. 默认留空 DSN，未配置时安全降级为 No-Op 空操作，零网络消耗
 * 2. 采样率与长生命周期内存调优：tracesSampleRate 控制为 10%，maxBreadcrumbs 上限为 50 条
 * 3. 过滤常见网络波动与浏览器非致命噪声（ResizeObserver 等）
 * 4. Session Replay 录屏暂不开启（保持包体积极小且 0 DOM 监控 CPU 开销，后续若需排查顽固 bug 可按注释启用）
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN || '';
  const mode =
    window.__APP_ENV__?.mode || (import.meta.env.DEV ? APP_ENV.DEVELOPMENT : APP_ENV.PRODUCTION);
  const isProd = mode === APP_ENV.PRODUCTION;

  Sentry.init({
    dsn,
    // 仅在显式配置了有效 DSN 且在生产环境时才开启网络上报
    enabled: Boolean(dsn) && isProd,
    environment: mode,

    // 1. 性能追踪采样率控制在 10%，避免耗尽云端配额
    tracesSampleRate: 0.1,

    // 2. 长生命周期内存防泄漏：限制最近用户操作轨迹条数
    maxBreadcrumbs: 50,

    // 3. 忽略非业务崩溃的常见噪声异常
    ignoreErrors: [
      'ResizeObserver loop completed with undelivered notifications',
      'ResizeObserver loop limit exceeded',
      'Network Error',
      'Failed to fetch',
      'Load failed',
    ],

    // 4. Session Replay 暂时停用以保证最高性能与最低包体积
    // 若后续需要开启“仅崩溃时抓取前 30 秒录屏”，可解开以下配置并引入 replayIntegration：
    // replaysSessionSampleRate: 0,
    // replaysOnErrorSampleRate: 1.0,
    // integrations: [
    //   Sentry.replayIntegration({
    //     maskAllText: true,
    //     blockAllMedia: true,
    //   }),
    // ],
  });
}
