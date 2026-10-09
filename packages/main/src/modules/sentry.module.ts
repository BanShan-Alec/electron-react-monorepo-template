import * as Sentry from '@sentry/electron/main';
import { app, type BrowserWindow } from 'electron';
import type { AppModule } from '../AppModule';
import { appLifecycle } from '../lifecycle';
import type { ModuleContext } from '../ModuleContext';
import { getLogManager } from './log.module';

const logger = getLogManager().scoped('SentryModule');

/**
 * 获取用于 Sentry 初始化的 DSN
 * 优先取构建期 define 注入的常量，其次取运行时环境变量
 */
export function getSentryDsn(): string {
  if (typeof __SENTRY_DSN__ !== 'undefined' && __SENTRY_DSN__) {
    return __SENTRY_DSN__;
  }
  return process.env.SENTRY_DSN || '';
}

/**
 * 判断当前是否满足 Sentry 采集条件：
 * 严格限制仅打包后（app.isPackaged）且配置有效 DSN 时才激活
 */
export function isSentryEnabled(): boolean {
  return app.isPackaged && Boolean(getSentryDsn());
}

/**
 * 主进程 Sentry 全局初始化
 * 必须在主进程生命周期最早期同步执行
 */
export function initMainSentry(): void {
  const dsn = getSentryDsn();
  const enabled = isSentryEnabled();

  if (!enabled || !dsn) {
    logger.info('[Sentry] 初始化已跳过（未打包或未配置有效 DSN）');
    return;
  }

  const appVersion =
    typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? __APP_VERSION__ : app.getVersion();

  Sentry.init({
    dsn,
    enabled: true,
    environment: app.isPackaged ? 'production' : process.env.MODE || 'development',
    release: `electron-react-monorepo-template@${appVersion}`,

    // 彻底关闭行为监控（Breadcrumbs / DOM / Console / Net 轨迹）
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    integrations: (defaults) => defaults.filter((i) => !i.name.includes('Breadcrumb')),

    // 彻底关闭性能监控（Tracing / Profiling）
    tracesSampleRate: 0,
  });

  logger.info('[Sentry] 主进程初始化成功（仅打包采集 + 行为/性能监控已禁用）');
}

/**
 * Sentry 模块：托管窗口崩溃与未响应监听
 */
export class SentryModule implements AppModule {
  enable({ app }: ModuleContext): void {
    if (!isSentryEnabled()) {
      return;
    }

    // 1. 全局监听渲染进程崩溃 (render-process-gone)
    app.on('render-process-gone', (_event, webContents, details) => {
      logger.error('[render-process-gone] 渲染进程非预期退出:', details);

      if (appLifecycle.isQuitting || details.reason === 'clean-exit') {
        return;
      }

      let currentUrl = 'unknown';
      try {
        currentUrl = webContents.getURL();
      } catch {
        // webContents 可能已销毁
      }

      Sentry.captureException(
        new Error(
          `[Renderer Crash] process gone: reason=${details.reason}, exitCode=${details.exitCode}`,
        ),
        {
          level: 'fatal',
          tags: {
            process: 'renderer',
            crash_reason: details.reason,
            exit_code: String(details.exitCode),
          },
          extra: {
            details,
            url: currentUrl,
          },
        },
      );
    });

    // 2. 全局监听窗口无响应与恢复 (unresponsive / responsive)
    app.on('browser-window-created', (_event, window: BrowserWindow) => {
      window.on('unresponsive', () => {
        let currentUrl = 'unknown';
        try {
          currentUrl = window.webContents.getURL();
        } catch {}

        logger.error(`[unresponsive] 窗口 (id=${window.id}) 发生无响应卡死`);
        Sentry.captureMessage(`[Window Unresponsive] 窗口 (id=${window.id}) 发生无响应卡死`, {
          level: 'error',
          tags: {
            process: 'window',
            window_id: String(window.id),
          },
          extra: {
            url: currentUrl,
          },
        });
      });

      window.on('responsive', () => {
        logger.info(`[responsive] 窗口 (id=${window.id}) 已恢复正常响应`);
      });
    });
  }
}

export function createSentryModule(): SentryModule {
  return new SentryModule();
}
