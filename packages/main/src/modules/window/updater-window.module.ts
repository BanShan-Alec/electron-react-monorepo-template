import { IPC_CHANNELS } from '@app/shared/constants/ipc-channels';
import { WINDOW_IDS } from '@app/shared/constants/windows';
import { app, BrowserWindow } from 'electron';
import type { AppInitConfig } from '../../AppInitConfig';
import type { AppModule } from '../../AppModule';
import { appLifecycle } from '../../lifecycle';
import type { ModuleContext } from '../../ModuleContext';
import { updaterService } from '../../services/updater.service';
import { getLogManager } from '../log.module';
import { forgetWindow, getWindow, registerWindow, sendToWindow } from './window-registry';

export class UpdaterWindowModule implements AppModule {
  private readonly preload: { path: string };
  private readonly renderer: { path: string } | URL;
  private readonly logger = getLogManager().scoped('UpdaterWindowModule');

  constructor({ initConfig }: { initConfig: AppInitConfig }) {
    this.preload = initConfig.preload;
    this.renderer = initConfig.windows.updater;

    // 绑定更新服务的窗口代理
    updaterService.setWindowDelegate({
      show: () => this.show(),
      hide: () => this.close(),
    });
  }

  async enable({ app }: ModuleContext): Promise<void> {
    await app.whenReady();
  }

  async createWindow(): Promise<BrowserWindow> {
    const existing = getWindow(WINDOW_IDS.UPDATER);
    if (existing && !existing.isDestroyed()) {
      return existing;
    }

    this.logger.info('Creating updater browser window');

    const browserWindow = new BrowserWindow({
      show: false,
      width: 480,
      height: 460,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      frame: false,
      transparent: false,
      hasShadow: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webviewTag: false,
        preload: this.preload.path,
      },
    });

    registerWindow(WINDOW_IDS.UPDATER, browserWindow);

    browserWindow.once('ready-to-show', () => {
      this.logger.info('Updater window ready to show');
    });

    browserWindow.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL) => {
        this.logger.error(
          `Updater window failed to load URL "${validatedURL}": (${errorCode}) ${errorDescription}`,
        );
      },
    );

    browserWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
      this.logger.error(`Updater window preload script failed at "${preloadPath}":`, error);
    });

    browserWindow.webContents.on('did-finish-load', () => {
      this.logger.info('Updater window did-finish-load -> pushing snapshot');
      sendToWindow(
        WINDOW_IDS.UPDATER,
        IPC_CHANNELS.UPDATER_EVENT_STATE,
        updaterService.getSnapshot(),
      );
    });

    // 关闭更新窗口：销毁窗口实体，若主窗口已销毁则退出应用
    browserWindow.on('close', () => {
      const homeWin = getWindow(WINDOW_IDS.HOME);
      if (!appLifecycle.isQuitting && (!homeWin || homeWin.isDestroyed())) {
        this.logger.info('Home window does not exist, closing updater window will quit app');
        app.quit();
      } else {
        this.logger.info('Updater window closing and destroying');
      }
    });

    if (this.renderer instanceof URL) {
      await browserWindow.loadURL(this.renderer.href);
    } else {
      await browserWindow.loadFile(this.renderer.path);
    }

    return browserWindow;
  }

  async show(): Promise<BrowserWindow> {
    let win = getWindow(WINDOW_IDS.UPDATER);
    if (!win || win.isDestroyed()) {
      win = await this.createWindow();
    }

    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();

    // 立即向窗口同步最新状态快照
    sendToWindow(
      WINDOW_IDS.UPDATER,
      IPC_CHANNELS.UPDATER_EVENT_STATE,
      updaterService.getSnapshot(),
    );

    return win;
  }

  close(): void {
    const win = getWindow(WINDOW_IDS.UPDATER);
    if (win && !win.isDestroyed()) {
      win.close();
      this.logger.info('Updater window closed and destroyed');
    }
  }

  hide(): void {
    this.close();
  }

  destroy(): void {
    const win = getWindow(WINDOW_IDS.UPDATER);
    if (win && !win.isDestroyed()) {
      forgetWindow(WINDOW_IDS.UPDATER, win);
      win.destroy();
      this.logger.info('Updater window destroyed');
    }
  }
}

let singletonUpdaterWindowModule: UpdaterWindowModule | null = null;

export function getUpdaterWindowModule(): UpdaterWindowModule {
  if (!singletonUpdaterWindowModule) {
    throw new Error('UpdaterWindowModule has not been initialized');
  }
  return singletonUpdaterWindowModule;
}

export function createUpdaterWindowModule(
  ...args: ConstructorParameters<typeof UpdaterWindowModule>
): UpdaterWindowModule {
  singletonUpdaterWindowModule = new UpdaterWindowModule(...args);
  return singletonUpdaterWindowModule;
}
