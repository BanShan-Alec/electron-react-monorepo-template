import { ErrorCode } from '@app/shared/constants/error-codes';
import { IPC_CHANNELS } from '@app/shared/constants/ipc-channels';
import { WINDOW_IDS } from '@app/shared/constants/windows';
import type {
  UpdaterMockAction,
  UpdaterProgress,
  UpdaterSnapshot,
  UpdaterState,
} from '@app/shared/types/updater';
import { app, Notification } from 'electron';
import electronUpdater, { type AppUpdater, CancellationToken } from 'electron-updater';
import { AppError } from '../errors/AppError';
import { getAppConfigStore } from '../modules/config.module';
import { getLogManager } from '../modules/log.module';
import { getWindow, sendToWindow } from '../modules/window/window-registry';

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
  private readonly logger = getLogManager().scoped('UpdaterService');
  private cancellationToken: CancellationToken | null = null;
  private orphanWatchdogTimer: NodeJS.Timeout | null = null;
  private devSimulationTimer: NodeJS.Timeout | null = null;
  private isOrphan = false;
  private lastProgressEmitTime = 0;

  private snapshot: UpdaterSnapshot = {
    state: 'idle',
    progress: null,
    error: null,
  };

  private windowDelegate: { show: () => Promise<unknown>; hide: () => void } | null = null;

  constructor() {
    this.initElectronUpdater();
  }

  public setWindowDelegate(delegate: { show: () => Promise<unknown>; hide: () => void }): void {
    this.windowDelegate = delegate;
  }

  private getAutoUpdater(): AppUpdater {
    const { autoUpdater } = electronUpdater;
    return autoUpdater;
  }

  private initElectronUpdater(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    try {
      const updater = this.getAutoUpdater();
      updater.logger = this.logger;
      updater.autoDownload = false;
      updater.autoInstallOnAppQuit = false;
      updater.fullChangelog = true;

      if (process.env.VITE_DISTRIBUTION_CHANNEL) {
        updater.channel = process.env.VITE_DISTRIBUTION_CHANNEL;
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
        this.logger.info('Update downloaded:', info?.version);
        this.snapshot.state = 'downloaded';
        this.snapshot.progress = null;
        this.snapshot.error = null;
        this.cancellationToken = null;
        this.emitState();

        // 判定孤儿态（主窗口已关闭）
        const homeWin = getWindow(WINDOW_IDS.HOME);
        if (this.isOrphan || !homeWin || homeWin.isDestroyed()) {
          this.stopOrphanWatchdog();
          this.logger.info(
            'Home window destroyed. Executing Strategy A: quitAndInstall(true, false)',
          );
          try {
            updater.quitAndInstall(true, false);
          } catch (err) {
            this.logger.error('Failed to quitAndInstall in orphan mode:', err);
            app.quit();
          }
        } else {
          // 主窗口正常存活时，拉起更新窗口提醒用户立即重启安装
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

        const homeWin = getWindow(WINDOW_IDS.HOME);
        if (this.isOrphan || !homeWin) {
          this.stopOrphanWatchdog();
          this.logger.error('Orphan download failed with error, quitting app');
          app.quit();
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

    if (process.env.NODE_ENV === 'test') {
      return this.getSnapshot();
    }

    if (process.env.NODE_ENV !== 'production') {
      this.logger.info('Dev mode: running simulated check flow');
      if (this.devSimulationTimer) {
        clearInterval(this.devSimulationTimer);
        this.devSimulationTimer = null;
      }
      setTimeout(() => {
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
      }, 800);
      return this.getSnapshot();
    }

    try {
      const updater = this.getAutoUpdater();
      await updater.checkForUpdates();
      return this.getSnapshot();
    } catch (err) {
      this.snapshot.state = 'error';
      this.snapshot.error = err instanceof Error ? err.message : String(err);
      this.emitState();
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

    if (process.env.NODE_ENV === 'test') {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      this.logger.info('Dev mode: skipping silent check request');
      return;
    }

    this.logger.info('Starting silent update check on startup...');
    try {
      const updater = this.getAutoUpdater();
      await updater.checkForUpdates();
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

    if (process.env.NODE_ENV === 'test') {
      return this.getSnapshot();
    }

    if (process.env.NODE_ENV !== 'production') {
      this.logger.info('Dev mode: running simulated download flow');
      if (this.devSimulationTimer) {
        clearInterval(this.devSimulationTimer);
        this.devSimulationTimer = null;
      }

      let currentPercent = 0;
      this.devSimulationTimer = setInterval(() => {
        if (this.snapshot.state !== 'downloading') {
          if (this.devSimulationTimer) clearInterval(this.devSimulationTimer);
          this.devSimulationTimer = null;
          return;
        }

        currentPercent += 10;
        if (currentPercent >= 100) {
          if (this.devSimulationTimer) clearInterval(this.devSimulationTimer);
          this.devSimulationTimer = null;
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
      throw new AppError(this.snapshot.error, ErrorCode.UPDATER_DOWNLOAD_FAILED);
    }
  }

  public async cancel(): Promise<UpdaterSnapshot> {
    if (this.devSimulationTimer) {
      clearInterval(this.devSimulationTimer);
      this.devSimulationTimer = null;
    }

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
    if (process.env.NODE_ENV === 'test') {
      return { success: true };
    }

    if (process.env.NODE_ENV !== 'production') {
      this.logger.info('Dev mode: simulated install completed');
      return { success: true };
    }

    try {
      const updater = this.getAutoUpdater();
      updater.quitAndInstall(false, true);
      return { success: true };
    } catch (err) {
      this.logger.error('Failed to quit and install:', err);
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
      case 'downloaded':
        this.snapshot.state = 'downloaded';
        this.snapshot.progress = null;
        this.snapshot.error = null;
        this.emitState();
        if (this.isOrphan || !getWindow(WINDOW_IDS.HOME)) {
          this.stopOrphanWatchdog();
          if (process.env.NODE_ENV !== 'test') {
            try {
              this.getAutoUpdater().quitAndInstall(true, false);
            } catch {
              app.quit();
            }
          }
        }
        break;
      case 'up-to-date':
        this.snapshot = { state: 'up-to-date', progress: null, error: null };
        this.emitState();
        break;
      case 'error':
        this.snapshot.state = 'error';
        this.snapshot.error = action.message;
        this.snapshot.progress = null;
        this.emitState();
        if (this.isOrphan || !getWindow(WINDOW_IDS.HOME)) {
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
