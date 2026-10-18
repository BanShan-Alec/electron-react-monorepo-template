import { ErrorCode } from '@app/shared/constants/error-codes';
import { IPC_CHANNELS } from '@app/shared/constants/ipc-channels';
import { APP_FEATURES, buildSentryTags, SENTRY_TAGS } from '@app/shared/constants/telemetry';
import { WINDOW_IDS } from '@app/shared/constants/windows';
import type {
  UpdaterMockAction,
  UpdaterProgress,
  UpdaterSnapshot,
  UpdaterState,
} from '@app/shared/types/updater';
import { app, Notification } from 'electron';
import electronUpdater, { type AppUpdater, CancellationToken } from 'electron-updater';
import { getEnv, isDev, isPackaged, isTest } from '../env';
import { AppError } from '../errors/AppError';
import { getAppConfigStore } from '../modules/config.module';
import { getLogManager } from '../modules/log.module';
import { getWindow, sendToWindow } from '../modules/window/window-registry';

function isOtaSentryEnabled(): boolean {
  if (isTest || !isPackaged) return false;
  const dsn =
    typeof __SENTRY_DSN__ !== 'undefined' && __SENTRY_DSN__ ? __SENTRY_DSN__ : getEnv('SENTRY_DSN');
  return Boolean(dsn);
}

/**
 * OTA 错误上报时间去重窗口（毫秒）
 */
const OTA_ERROR_DEBOUNCE_MS = 1000;

/**
 * 孤儿下载退出前等待 Sentry 事件 flush 的超时时间（毫秒）
 */
const SENTRY_FLUSH_TIMEOUT_MS = 2000;

/**
 * OTA 流程各阶段标识，统一用于 Sentry 标签与事件追踪
 */
export const OTA_STAGES = {
  ELECTRON_UPDATER: 'electron-updater',
  CHECKING: 'checking',
  DOWNLOADING: 'downloading',
  INSTALLING: 'installing',
  DOWNLOADED: 'downloaded',
} as const;

export type OtaStage = (typeof OTA_STAGES)[keyof typeof OTA_STAGES];

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>?/gm, '');
}

function normalizeReleaseNotes(raw: unknown): string[] {
  if (!raw) return [];
  const list: string[] = [];

  const addLines = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => stripHtml(l).trim())
      .filter(Boolean);
    list.push(...lines);
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        addLines(item);
      } else if (item && typeof item === 'object' && 'note' in item) {
        addLines(String((item as { note: unknown }).note));
      }
    }
  } else if (typeof raw === 'string') {
    addLines(raw);
  }
  return list;
}

export class UpdaterService {
  private readonly logger = getLogManager().scoped(this);
  private cancellationToken: CancellationToken | null = null;
  private orphanWatchdogTimer: NodeJS.Timeout | null = null;
  private devSimulationTimer: NodeJS.Timeout | null = null;
  private isOrphan = false;
  private lastProgressEmitTime = 0;
  private lastReportedErrorTime = 0;
  private lastReportedErrorKey = '';

  private snapshot: UpdaterSnapshot = {
    state: 'idle',
    progress: null,
    error: null,
  };

  private windowDelegate: { show: () => Promise<unknown>; close?: () => void } | null = null;
  private userDismissedWindow = false;

  private async withSentry(
    action: (sentry: typeof import('@sentry/electron/main')) => Promise<unknown> | unknown,
  ): Promise<void> {
    if (!isOtaSentryEnabled()) return;
    try {
      const Sentry = await import('@sentry/electron/main');
      await action(Sentry);
    } catch (sentryErr) {
      this.logger.warn('Failed to execute Sentry operation:', sentryErr);
    }
  }

  private reportSentryOtaError(err: unknown, stage: OtaStage): void {
    if (!isOtaSentryEnabled()) return;
    const errorObj = err instanceof Error ? err : new Error(String(err));
    const errorKey = `${stage}:${errorObj.message}:${errorObj.stack?.slice(0, 100) || ''}`;
    const now = Date.now();
    if (
      now - this.lastReportedErrorTime < OTA_ERROR_DEBOUNCE_MS &&
      this.lastReportedErrorKey === errorKey
    ) {
      return;
    }
    this.lastReportedErrorTime = now;
    this.lastReportedErrorKey = errorKey;

    void this.withSentry((Sentry) => {
      Sentry.captureException(errorObj, {
        tags: buildSentryTags(APP_FEATURES.OTA, {
          [SENTRY_TAGS.LOGGER]: this.constructor.name,
          [SENTRY_TAGS.STAGE]: stage,
          [SENTRY_TAGS.TARGET_VERSION]: this.snapshot.version || 'unknown',
          [SENTRY_TAGS.CURRENT_VERSION]: app.getVersion(),
        }),
        extra: {
          rawMessage: errorObj.message,
          snapshotState: this.snapshot.state,
        },
      });
    });
  }

  private reportSentryOtaEvent(message: string, stage: OtaStage, targetVersion?: string): void {
    if (!isOtaSentryEnabled()) return;
    void this.withSentry((Sentry) => {
      Sentry.captureMessage(message, {
        level: 'info',
        tags: buildSentryTags(APP_FEATURES.OTA, {
          [SENTRY_TAGS.LOGGER]: this.constructor.name,
          [SENTRY_TAGS.STAGE]: stage,
          [SENTRY_TAGS.TARGET_VERSION]: targetVersion || 'unknown',
          [SENTRY_TAGS.CURRENT_VERSION]: app.getVersion(),
        }),
      });
    });
  }

  private clearDevSimulationTimer(): void {
    if (this.devSimulationTimer) {
      clearTimeout(this.devSimulationTimer);
      clearInterval(this.devSimulationTimer);
      this.devSimulationTimer = null;
    }
  }

  constructor() {
    this.initElectronUpdater();
  }

  public setWindowDelegate(delegate: { show: () => Promise<unknown>; close?: () => void }): void {
    this.windowDelegate = delegate;
  }

  public notifyWindowShown(): void {
    this.userDismissedWindow = false;
  }

  public notifyWindowClosed(): void {
    this.userDismissedWindow = true;
  }

  private getAutoUpdater(): AppUpdater {
    const { autoUpdater } = electronUpdater;
    return autoUpdater;
  }

  private initElectronUpdater(): void {
    if (isTest) {
      return;
    }

    try {
      const updater = this.getAutoUpdater();
      updater.logger = this.logger;
      updater.autoDownload = false;
      updater.autoInstallOnAppQuit = false;
      updater.fullChangelog = true;

      const channel = getEnv('DISTRIBUTION_CHANNEL');
      if (channel) {
        updater.channel = channel;
      }

      // 已打包生产态 (app.isPackaged) 下由 electron-updater 自动读取 resources/app-update.yml；
      // 仅在未打包形态（源码运行）时若配置了 GITHUB_OWNER/REPO 才手动 setFeedURL
      if (!isPackaged) {
        const owner = getEnv('GITHUB_OWNER');
        const repo = getEnv('GITHUB_REPO');

        if (owner && repo) {
          updater.setFeedURL({
            provider: 'github',
            owner,
            repo,
          });
        } else {
          this.logger.warn(
            'Auto-updater skipped setFeedURL: GITHUB_OWNER or GITHUB_REPO not configured in unpackaged mode.',
          );
        }
      }

      updater.on('checking-for-update', () => {
        this.logger.info('Checking for update...');
        this.snapshot.state = 'checking';
        this.snapshot.error = null;
        this.emitState();
      });

      updater.on('update-available', (info) => {
        this.logger.info('Update available:', info.version);
        const notes = normalizeReleaseNotes(info.releaseNotes);
        this.snapshot = {
          state: 'available',
          version: info.version,
          releaseDate: typeof info.releaseDate === 'string' ? info.releaseDate : undefined,
          releaseNotes: notes.length > 0 ? notes : undefined,
          progress: null,
          error: null,
        };
        this.emitState();
        this.windowDelegate?.show().catch((err) => {
          this.logger.error('Failed to show updater window on update-available:', err);
        });
      });

      updater.on('update-not-available', (info) => {
        this.logger.info('Update not available:', info?.version);
        this.snapshot = {
          state: 'up-to-date',
          version: info?.version,
          progress: null,
          error: null,
        };
        this.emitState();
      });

      updater.on('download-progress', (progressObj) => {
        const progress: UpdaterProgress = {
          percent: Math.min(100, Math.max(0, Math.round(progressObj.percent))),
          bytesPerSecond: Math.round(progressObj.bytesPerSecond || 0),
          transferred: Math.round(progressObj.transferred || 0),
          total: Math.round(progressObj.total || 0),
        };
        this.emitProgress(progress);
      });

      updater.on('update-downloaded', (info) => {
        const downloadedVersion = info?.version || 'unknown';
        this.logger.info('Update downloaded:', downloadedVersion);
        this.snapshot.state = 'downloaded';
        this.snapshot.progress = null;
        this.snapshot.error = null;
        this.cancellationToken = null;
        this.emitState();
        this.reportSentryOtaEvent(
          `OTA Downloaded: ${downloadedVersion}`,
          OTA_STAGES.DOWNLOADED,
          info?.version,
        );

        // 判定孤儿态（在退出流程中后台下载完成）
        if (this.isOrphan) {
          this.stopOrphanWatchdog();
          this.logger.info(
            'App closing orphan mode: Executing Strategy A: quitAndInstall(true, false)',
          );
          const executeInstall = () => {
            try {
              updater.quitAndInstall(true, false);
            } catch (err) {
              this.logger.error('Failed to quitAndInstall in orphan mode:', err);
              app.quit();
            }
          };

          if (isOtaSentryEnabled()) {
            void this.withSentry((Sentry) => Sentry.flush(SENTRY_FLUSH_TIMEOUT_MS)).finally(
              executeInstall,
            );
          } else {
            executeInstall();
          }
        } else if (this.userDismissedWindow) {
          this.logger.info(
            'User dismissed window previously, sending system notification instead of popup',
          );
          if (Notification.isSupported()) {
            const isZh = getAppConfigStore().get('language') === 'zh-CN';
            const notif = new Notification({
              title: app.getName(),
              body: isZh
                ? '新版本已下载完毕，点击立即安装。'
                : 'New version downloaded. Click to install.',
            });
            notif.on('click', () => {
              this.windowDelegate?.show().catch((err) => {
                this.logger.error('Failed to show updater window from notification click:', err);
              });
            });
            notif.show();
          }
        } else {
          // 主窗口正常存活且未被主动关闭时，拉起更新窗口提醒用户立即重启安装
          this.windowDelegate?.show().catch((err) => {
            this.logger.error('Failed to show updater window on update-downloaded:', err);
          });
        }
      });

      updater.on('error', (err) => {
        this.logger.error('Update error:', err);
        this.snapshot.state = 'error';
        this.snapshot.error = err ? err.message : 'Unknown updater error';
        this.snapshot.progress = null;
        this.cancellationToken = null;
        this.emitState();
        this.reportSentryOtaError(err, OTA_STAGES.ELECTRON_UPDATER);

        if (this.isOrphan) {
          this.stopOrphanWatchdog();
          this.logger.error('Orphan download failed with error, quitting app');
          if (isOtaSentryEnabled()) {
            void this.withSentry((Sentry) => Sentry.flush(SENTRY_FLUSH_TIMEOUT_MS)).finally(() => {
              app.quit();
            });
          } else {
            app.quit();
          }
        }
      });
    } catch (err) {
      this.logger.warn('Failed to configure electron-updater:', err);
    }
  }

  public getSnapshot(): UpdaterSnapshot {
    return { ...this.snapshot };
  }

  public getState(): UpdaterState {
    return this.snapshot.state;
  }

  public async check(): Promise<UpdaterSnapshot> {
    if (this.snapshot.state === 'checking' || this.snapshot.state === 'downloading') {
      throw new AppError(
        'Updater is already running a check or download task',
        ErrorCode.UPDATER_ALREADY_RUNNING,
      );
    }

    this.snapshot.state = 'checking';
    this.snapshot.error = null;
    this.snapshot.progress = null;
    this.emitState();

    if (isTest) {
      return this.getSnapshot();
    }

    if (isDev) {
      this.logger.info('Dev mode: running simulated check flow');
      this.clearDevSimulationTimer();
      this.devSimulationTimer = setTimeout(() => {
        this.devSimulationTimer = null;
        if (this.snapshot.state === 'checking') {
          this.mockEmit({
            type: 'available',
            version: '2.0.0',
            releaseDate: new Date().toISOString().split('T')[0],
            releaseNotes: [
              '【Dev 模式模拟更新】',
              '统一多平台应用运行图标与安装包图标',
              '支持 NSIS 自定义安装目录选择',
              'OTA 窗口采用无边框纯平贴边现代布局与内嵌按钮',
              '解耦窗口物理销毁与后台静默下载生命周期',
            ],
          });
        }
      }, 800) as unknown as NodeJS.Timeout;
      return this.getSnapshot();
    }

    // 仅在未打包形态下检查仓库配置（已打包状态直接由 electron-updater 读取 resources/app-update.yml）
    if (!isPackaged) {
      const owner = getEnv('GITHUB_OWNER');
      const repo = getEnv('GITHUB_REPO');
      if (!owner || !repo) {
        this.logger.warn(
          'Auto-updater check aborted: GITHUB_OWNER or GITHUB_REPO not configured in unpackaged mode.',
        );
        this.snapshot.state = 'error';
        this.snapshot.error = '自动更新未配置仓库信息 (缺少 GITHUB_OWNER 或 GITHUB_REPO)';
        this.emitState();
        throw new AppError(this.snapshot.error, ErrorCode.UPDATER_NOT_CONFIGURED);
      }
    }

    try {
      const updater = this.getAutoUpdater();
      let timer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('检查更新请求超时（15 秒），请检查网络连接后重试')),
          15000,
        );
      });
      try {
        await Promise.race([updater.checkForUpdates(), timeoutPromise]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      return this.getSnapshot();
    } catch (err) {
      this.snapshot.state = 'error';
      this.snapshot.error = err instanceof Error ? err.message : String(err);
      this.emitState();
      this.reportSentryOtaError(err, OTA_STAGES.CHECKING);
      throw new AppError(this.snapshot.error, ErrorCode.UPDATER_CHECK_FAILED);
    }
  }

  /**
   * 应用启动时的静默检查更新逻辑
   * 不主动向用户展示报错或无更新状态，仅在发现新版本时触发通知/弹窗
   */
  public async checkSilently(): Promise<void> {
    if (this.snapshot.state === 'checking' || this.snapshot.state === 'downloading') {
      return;
    }

    if (isTest) {
      return;
    }

    if (isDev) {
      this.logger.info('Dev mode: skipping silent check request');
      return;
    }

    if (!isPackaged) {
      const owner = getEnv('GITHUB_OWNER');
      const repo = getEnv('GITHUB_REPO');
      if (!owner || !repo) {
        this.logger.info(
          'Silent update check skipped: GITHUB_OWNER or GITHUB_REPO not configured in unpackaged mode.',
        );
        return;
      }
    }

    this.logger.info('Starting silent update check on startup...');
    try {
      const updater = this.getAutoUpdater();
      let timer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('静默检查更新超时（15 秒）')), 15000);
      });
      try {
        await Promise.race([updater.checkForUpdates(), timeoutPromise]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    } catch (err) {
      this.logger.warn('Silent update check encountered error (ignored):', err);
    }
  }

  public async download(): Promise<UpdaterSnapshot> {
    if (this.snapshot.state === 'downloading') {
      throw new AppError('Download is already in progress', ErrorCode.UPDATER_ALREADY_RUNNING);
    }

    if (this.snapshot.state !== 'available' && this.snapshot.state !== 'error') {
      throw new AppError('No update available to download', ErrorCode.UPDATER_NO_UPDATE);
    }

    this.cancellationToken = new CancellationToken();
    this.snapshot.state = 'downloading';
    this.snapshot.error = null;
    this.emitState();

    if (isTest) {
      return this.getSnapshot();
    }

    if (isDev) {
      this.logger.info('Dev mode: running simulated download flow');
      this.clearDevSimulationTimer();

      let currentPercent = 0;
      this.devSimulationTimer = setInterval(() => {
        if (this.snapshot.state !== 'downloading') {
          this.clearDevSimulationTimer();
          return;
        }

        currentPercent += 10;
        if (currentPercent >= 100) {
          this.clearDevSimulationTimer();
          this.mockEmit({ type: 'downloaded' });
        } else {
          this.mockEmit({
            type: 'progress',
            percent: currentPercent,
            bytesPerSecond: 3.5 * 1024 * 1024,
            transferred: Math.round((currentPercent / 100) * 85 * 1024 * 1024),
            total: 85 * 1024 * 1024,
          });
        }
      }, 500);

      return this.getSnapshot();
    }

    try {
      const updater = this.getAutoUpdater();
      await updater.downloadUpdate(this.cancellationToken);
      return this.getSnapshot();
    } catch (err) {
      if (this.cancellationToken?.cancelled) {
        this.logger.info('Download cancelled by token');
        return this.getSnapshot();
      }
      this.snapshot.state = 'error';
      this.snapshot.error = err instanceof Error ? err.message : String(err);
      this.cancellationToken = null;
      this.emitState();
      this.reportSentryOtaError(err, OTA_STAGES.DOWNLOADING);
      throw new AppError(this.snapshot.error, ErrorCode.UPDATER_DOWNLOAD_FAILED);
    }
  }

  public async cancel(): Promise<UpdaterSnapshot> {
    this.clearDevSimulationTimer();

    if (this.snapshot.state === 'downloading') {
      if (this.cancellationToken) {
        try {
          this.cancellationToken.cancel();
        } catch (err) {
          this.logger.warn('Failed to cancel token:', err);
        }
        this.cancellationToken = null;
      }
      this.snapshot.state = 'available';
      this.snapshot.progress = null;
      this.snapshot.error = null;
      this.emitState();

      // 如果当前处于孤儿态（主窗口已关闭），取消后退出应用杜绝无界面僵尸进程
      const homeWin = getWindow(WINDOW_IDS.HOME);
      if (this.isOrphan || !homeWin || homeWin.isDestroyed()) {
        this.stopOrphanWatchdog();
        this.logger.info('Orphan download cancelled by user, quitting app');
        app.quit();
      }
    }
    return this.getSnapshot();
  }

  public async install(): Promise<{ success: boolean }> {
    if (this.snapshot.state !== 'downloaded') {
      throw new AppError('Update is not ready to install', ErrorCode.UPDATER_INSTALL_FAILED);
    }

    this.logger.info('Initiating install: quitAndInstall(false, true)');
    if (isTest) {
      return { success: true };
    }

    if (isDev) {
      this.logger.info('Dev mode: simulated install completed');
      return { success: true };
    }

    try {
      const updater = this.getAutoUpdater();
      updater.quitAndInstall(false, true);
      return { success: true };
    } catch (err) {
      this.logger.error('Failed to quit and install:', err);
      this.reportSentryOtaError(err, OTA_STAGES.INSTALLING);
      throw new AppError(
        err instanceof Error ? err.message : String(err),
        ErrorCode.UPDATER_INSTALL_FAILED,
      );
    }
  }

  public startOrphanWatchdog(timeoutMs = 15 * 60 * 1000): void {
    this.isOrphan = true;
    if (this.orphanWatchdogTimer) {
      clearTimeout(this.orphanWatchdogTimer);
    }
    this.logger.info(`Starting orphan download watchdog for ${timeoutMs}ms`);
    this.orphanWatchdogTimer = setTimeout(() => {
      this.logger.error('Orphan download watchdog timed out. Cancelling and quitting.');
      if (this.cancellationToken) {
        try {
          this.cancellationToken.cancel();
        } catch {}
        this.cancellationToken = null;
      }
      if (Notification.isSupported()) {
        const isZh = getAppConfigStore().get('language') === 'zh-CN';
        new Notification({
          title: app.getName(),
          body: isZh
            ? '后台更新下载超时，已中止任务。'
            : 'Background update download timed out. Task aborted.',
        }).show();
      }
      app.quit();
    }, timeoutMs);
  }

  public stopOrphanWatchdog(): void {
    this.isOrphan = false;
    if (this.orphanWatchdogTimer) {
      clearTimeout(this.orphanWatchdogTimer);
      this.orphanWatchdogTimer = null;
    }
  }

  private emitState(): void {
    sendToWindow(WINDOW_IDS.UPDATER, IPC_CHANNELS.UPDATER_EVENT_STATE, this.getSnapshot());
  }

  private emitProgress(progress: UpdaterProgress): void {
    this.snapshot.progress = progress;
    const now = Date.now();
    if (now - this.lastProgressEmitTime >= 250 || progress.percent >= 100) {
      this.lastProgressEmitTime = now;
      sendToWindow(WINDOW_IDS.UPDATER, IPC_CHANNELS.UPDATER_EVENT_PROGRESS, progress);
    }
  }

  /**
   * E2E 测试 Mock 注入适配器
   */
  public mockEmit(action: UpdaterMockAction): void {
    this.logger.info('Mock emit action:', action);
    switch (action.type) {
      case 'state':
        this.snapshot = { ...action.payload };
        this.emitState();
        break;
      case 'idle':
        this.snapshot = { state: 'idle', progress: null, error: null };
        this.emitState();
        break;
      case 'checking':
        this.snapshot = { state: 'checking', progress: null, error: null };
        this.emitState();
        break;
      case 'available':
        this.snapshot = {
          state: 'available',
          version: action.version || '2.0.0',
          releaseDate: action.releaseDate,
          releaseNotes: action.releaseNotes
            ? normalizeReleaseNotes(action.releaseNotes)
            : undefined,
          progress: null,
          error: null,
        };
        this.emitState();
        this.windowDelegate?.show().catch(() => {});
        break;
      case 'progress': {
        this.snapshot.state = 'downloading';
        const progress: UpdaterProgress = {
          percent: action.percent,
          bytesPerSecond: action.bytesPerSecond ?? 2.5 * 1024 * 1024,
          transferred: action.transferred ?? Math.round(action.percent * 1024 * 1024),
          total: action.total ?? 100 * 1024 * 1024,
        };
        this.emitProgress(progress);
        this.emitState();
        break;
      }
      case 'downloaded': {
        this.snapshot.state = 'downloaded';
        this.snapshot.progress = null;
        this.snapshot.error = null;
        this.emitState();
        if (this.isOrphan) {
          this.stopOrphanWatchdog();
          if (!isTest) {
            try {
              this.getAutoUpdater().quitAndInstall(true, false);
            } catch {
              app.quit();
            }
          }
        } else if (this.userDismissedWindow) {
          if (Notification.isSupported()) {
            const isZh = getAppConfigStore().get('language') === 'zh-CN';
            const notif = new Notification({
              title: app.getName(),
              body: isZh
                ? '新版本已下载完毕，点击立即安装。'
                : 'New version downloaded. Click to install.',
            });
            notif.on('click', () => {
              this.windowDelegate?.show().catch(() => {});
            });
            notif.show();
          }
        } else {
          this.windowDelegate?.show().catch(() => {});
        }
        break;
      }
      case 'up-to-date':
        this.snapshot = { state: 'up-to-date', progress: null, error: null };
        this.emitState();
        break;
      case 'error':
        this.snapshot.state = 'error';
        this.snapshot.error = action.message;
        this.snapshot.progress = null;
        this.emitState();
        if (this.isOrphan) {
          this.stopOrphanWatchdog();
          app.quit();
        }
        break;
    }
  }
}

export const updaterService = new UpdaterService();

// 挂载全局对象以便测试或调试
(globalThis as unknown as { __updaterService?: UpdaterService }).__updaterService = updaterService;
(
  globalThis as unknown as { __updaterMock?: { emit: (a: UpdaterMockAction) => void } }
).__updaterMock = {
  emit: (action) => updaterService.mockEmit(action),
};
