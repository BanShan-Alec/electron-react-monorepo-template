import { WINDOW_IDS } from '@app/shared/constants/windows';
import { app, BrowserWindow, Notification } from 'electron';
import type { AppInitConfig } from '../../AppInitConfig';
import type { AppModule } from '../../AppModule';
import { appLifecycle } from '../../lifecycle';
import type { ModuleContext } from '../../ModuleContext';
import { updaterService } from '../../services/updater.service';
import { getAppConfigStore } from '../config.module';
import { getLogManager } from '../log.module';
import { getTitleBarOverlayOptions, getWindowBackgroundColor } from './titlebar-overlay';
import { getUpdaterWindowModule } from './updater-window.module';
import { forgetWindow, getWindow, registerWindow } from './window-registry';
import { attachWindowsWindowRepaint } from './window-repaint';
import { DEFAULT_WINDOW_STATE, type WindowState, WindowStateKeeper } from './window-state-keeper';

export interface WindowManagerOptions {
  initConfig: AppInitConfig;
  openDevTools?: boolean;
  keepState?: boolean;
}

export class WindowManager implements AppModule {
  private readonly preload: { path: string };
  private readonly renderer: { path: string } | URL;
  private readonly openDevTools: boolean;
  private readonly keepState: boolean;
  private readonly windowStateKeeper: WindowStateKeeper | null;

  constructor({ initConfig, openDevTools = false, keepState = true }: WindowManagerOptions) {
    this.preload = initConfig.preload;
    this.renderer = initConfig.windows.home;
    this.openDevTools = openDevTools;
    this.keepState = keepState;
    this.windowStateKeeper = keepState ? new WindowStateKeeper() : null;
  }

  async enable({ app: electronApp }: ModuleContext): Promise<void> {
    await electronApp.whenReady();
    if (this.keepState && this.windowStateKeeper) {
      this.windowStateKeeper.validateWithDisplays();
    }
    await this.restoreOrCreateWindow(true);

    const handleReactivation = async () => {
      const homeWin = getWindow(WINDOW_IDS.HOME);
      if (homeWin) {
        await this.restoreOrCreateWindow(true);
      } else {
        const updaterWin = getWindow(WINDOW_IDS.UPDATER);
        if (updaterWin) {
          await getUpdaterWindowModule().show();
        } else {
          await this.restoreOrCreateWindow(true);
        }
      }
    };
    electronApp.on('second-instance', () => handleReactivation());
    electronApp.on('activate', () => handleReactivation());
  }

  async createWindow(): Promise<BrowserWindow> {
    const savedState: WindowState =
      this.keepState && this.windowStateKeeper
        ? this.windowStateKeeper.getState()
        : DEFAULT_WINDOW_STATE;

    const logger = getLogManager().scoped('WindowManager');

    logger.info('Creating browser window with state:', savedState);

    // 原生标题栏定制（平台分支参照 VS Code windows.ts/windowImpl.ts）：
    // - darwin: titleBarStyle hidden 保留红绿灯；titleBarOverlay: true 仅启用
    //   WCO JS API 与 CSS env(titlebar-area-*)（color/symbolColor 在 darwin 无效）
    // - win32: hidden + frame:false 启用 WCO，overlay 颜色随主题
    //   （运行时更新见 native-theme.module applyTitleBarOverlay）
    // - linux: 保持系统默认边框，不做定制
    const isMac = process.platform === 'darwin';
    const isWin = process.platform === 'win32';

    const browserWindow = new BrowserWindow({
      // 首屏渐进式加载：不设 show:false 门禁，窗口创建即可见，
      // 首个可视内容为 backgroundColor 主题底色（与 WCO overlay 同源），禁止白屏期
      x: savedState.x,
      y: savedState.y,
      width: savedState.width,
      height: savedState.height,
      // 最小尺寸下限，防止窗口缩到布局不可用（updater 窗口为 420×400）
      minWidth: 720,
      minHeight: 480,
      backgroundColor: getWindowBackgroundColor(),
      ...(isMac ? { titleBarStyle: 'hidden', titleBarOverlay: true } : {}),
      ...(isWin
        ? {
            titleBarStyle: 'hidden',
            frame: false,
            titleBarOverlay: getTitleBarOverlayOptions(),
          }
        : {}),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webviewTag: false,
        preload: this.preload.path,
      },
    });

    // 注册到 window-registry 唯一事实源
    registerWindow(WINDOW_IDS.HOME, browserWindow);
    browserWindow.on('closed', () => {
      forgetWindow(WINDOW_IDS.HOME, browserWindow);
    });

    // 绑定窗口尺寸/位置状态跟踪（若开启）
    if (this.keepState && this.windowStateKeeper) {
      this.windowStateKeeper.track(browserWindow);
    }

    // win32 dom-ready 补偿：无边框窗口在 dom-ready 前可能未完成首帧合成，
    // 补一次 show+focus 避免任务栏有图标但窗口不可见（对齐上游 desktopWindowLifecycle）
    browserWindow.webContents.on('dom-ready', () => {
      if (process.platform === 'win32' && !browserWindow.isDestroyed()) {
        browserWindow.show();
        browserWindow.focus();
      }
      if (this.openDevTools) {
        browserWindow.webContents.openDevTools();
      }
    });

    browserWindow.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL) => {
        logger.error(`Failed to load URL "${validatedURL}": (${errorCode}) ${errorDescription}`);
      },
    );

    browserWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
      logger.error(`Preload script failed to load at "${preloadPath}":`, error);
    });

    // 支持点击关闭按钮最小化到系统托盘及防僵尸退出闭环
    browserWindow.on('close', (event) => {
      const configStore = getAppConfigStore();
      const shouldMinimizeToTray = configStore.get('minimizeToTray');

      if (!appLifecycle.isQuitting && shouldMinimizeToTray) {
        event.preventDefault();
        browserWindow.hide();
        logger.info('Home window closed event intercepted -> minimized to tray');
      } else {
        logger.info('Home window is closing');
        const updaterState = updaterService.getState();
        if (updaterState === 'downloading') {
          logger.info(
            'Updater is downloading, keeping updater in background with watchdog (Strategy A)',
          );
          try {
            getUpdaterWindowModule().close();
          } catch {}
          if (Notification.isSupported()) {
            const isZh = configStore.get('language') === 'zh-CN';
            new Notification({
              title: app.getName(),
              body: isZh
                ? '应用已关闭，正在后台下载更新...'
                : 'Application closed. Downloading update in background...',
            }).show();
          }
          updaterService.startOrphanWatchdog();
        } else {
          logger.info(
            'Home window closed and updater not downloading -> destroying updater and quitting',
          );
          try {
            getUpdaterWindowModule().destroy();
          } catch {}
          app.quit();
        }
      }
    });

    // 无边框重绘守护全生命周期挂载（win32）：跨屏拖拽 / Snap / 锁屏唤醒后补绘
    attachWindowsWindowRepaint(browserWindow);

    // maximize 前置于 load：窗口创建即可见后，若在 load 后最大化会产生可见的尺寸跳变
    if (savedState.isMaximized) {
      browserWindow.maximize();
    }

    if (this.renderer instanceof URL) {
      await browserWindow.loadURL(this.renderer.href);
    } else {
      await browserWindow.loadFile(this.renderer.path);
    }

    return browserWindow;
  }

  async restoreOrCreateWindow(show = false) {
    let window = getWindow(WINDOW_IDS.HOME);

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
