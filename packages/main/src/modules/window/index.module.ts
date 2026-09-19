import { BrowserWindow } from 'electron';
import type { AppInitConfig } from '../../AppInitConfig';
import type { AppModule } from '../../AppModule';
import type { ModuleContext } from '../../ModuleContext';
import { getAppConfigStore } from '../config.module';
import { getLogManager } from '../log.module';
import { TrayManager } from '../tray.module';
import { DEFAULT_WINDOW_STATE, type WindowState, WindowStateKeeper } from './window-state-keeper';

export interface WindowManagerOptions {
  initConfig: AppInitConfig;
  openDevTools?: boolean;
  keepState?: boolean;
}

export class WindowManager implements AppModule {
  readonly #preload: { path: string };
  readonly #renderer: { path: string } | URL;
  readonly #openDevTools: boolean;
  readonly #keepState: boolean;
  readonly #windowStateKeeper: WindowStateKeeper | null;

  constructor({ initConfig, openDevTools = false, keepState = true }: WindowManagerOptions) {
    this.#preload = initConfig.preload;
    this.#renderer = initConfig.renderer;
    this.#openDevTools = openDevTools;
    this.#keepState = keepState;
    this.#windowStateKeeper = keepState ? new WindowStateKeeper() : null;
  }

  async enable({ app }: ModuleContext): Promise<void> {
    await app.whenReady();
    if (this.#keepState && this.#windowStateKeeper) {
      this.#windowStateKeeper.validateWithDisplays();
    }
    await this.restoreOrCreateWindow(true);
    app.on('second-instance', () => this.restoreOrCreateWindow(true));
    app.on('activate', () => this.restoreOrCreateWindow(true));
  }

  async createWindow(): Promise<BrowserWindow> {
    const savedState: WindowState =
      this.#keepState && this.#windowStateKeeper
        ? this.#windowStateKeeper.getState()
        : DEFAULT_WINDOW_STATE;

    const logger = getLogManager().mainLogger;

    logger.info('[WindowManager] Creating browser window with state:', savedState);

    const browserWindow = new BrowserWindow({
      show: false, // Use the 'ready-to-show' event to show the instantiated BrowserWindow.
      x: savedState.x,
      y: savedState.y,
      width: savedState.width,
      height: savedState.height,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webviewTag: false,
        preload: this.#preload.path,
      },
    });

    // 绑定窗口尺寸/位置状态跟踪（若开启）
    if (this.#keepState && this.#windowStateKeeper) {
      this.#windowStateKeeper.track(browserWindow);
    }

    browserWindow.once('ready-to-show', () => {
      if (savedState.isMaximized) {
        browserWindow.maximize();
      }
      browserWindow.show();
      if (this.#openDevTools) {
        browserWindow.webContents.openDevTools();
      }
      logger.info('[WindowManager] Window displayed successfully');
    });

    browserWindow.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL) => {
        logger.error(
          `[WindowManager] Failed to load URL "${validatedURL}": (${errorCode}) ${errorDescription}`,
        );
      },
    );

    browserWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
      logger.error(`[WindowManager] Preload script failed to load at "${preloadPath}":`, error);
    });

    // 支持点击关闭按钮最小化到系统托盘
    browserWindow.on('close', (event) => {
      const configStore = getAppConfigStore();
      const shouldMinimizeToTray = configStore.get('minimizeToTray');

      if (!TrayManager.isQuitting && shouldMinimizeToTray) {
        event.preventDefault();
        browserWindow.hide();
        logger.info('[WindowManager] Window closed event intercepted -> minimized to tray');
      } else {
        logger.info('[WindowManager] Window is closing and exiting');
      }
    });

    if (this.#renderer instanceof URL) {
      await browserWindow.loadURL(this.#renderer.href);
    } else {
      await browserWindow.loadFile(this.#renderer.path);
    }

    return browserWindow;
  }

  async restoreOrCreateWindow(show = false) {
    let window = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());

    if (window === undefined) {
      window = await this.createWindow();
    }

    if (!show) {
      return window;
    }

    if (window.isMinimized()) {
      window.restore();
    }

    window.show();
    window.focus();

    return window;
  }
}

export function createWindowManagerModule(
  ...args: ConstructorParameters<typeof WindowManager>
): WindowManager {
  return new WindowManager(...args);
}

export type { WindowState };
export { WindowStateKeeper };
