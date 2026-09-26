import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron';
import type { AppModule } from '../AppModule';
import type { ModuleContext } from '../ModuleContext';
import { getLogManager } from './log.module';

export class TrayManager implements AppModule {
  #tray: Tray | null = null;
  readonly #logger = getLogManager().scoped(this);
  static isQuitting = false;

  public enable({ app: electronApp }: ModuleContext): void {
    electronApp.whenReady().then(() => {
      this.initTray();
    });

    electronApp.on('before-quit', () => {
      TrayManager.isQuitting = true;
    });
  }

  public initTray(): Tray | null {
    if (this.#tray) return this.#tray;

    try {
      const iconPath = this.#resolveIconPath();
      let icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
      if (icon.isEmpty()) {
        icon = nativeImage.createEmpty();
      } else {
        if (process.platform === 'darwin') {
          icon.setTemplateImage(true);
        }
        icon = icon.resize({ width: 16, height: 16 });
      }

      this.#tray = new Tray(icon);
      this.#tray.setToolTip(`${app.getName()} - 桌面客户端`);

      const contextMenu = Menu.buildFromTemplate([
        {
          label: '显示主窗口',
          click: () => this.restoreMainWindow(),
        },
        {
          label: '检查更新',
          click: () => {
            this.#logger.info('User requested update check');
            this.restoreMainWindow();
          },
        },
        { type: 'separator' },
        {
          label: '退出应用',
          click: () => {
            TrayManager.isQuitting = true;
            app.quit();
          },
        },
      ]);

      this.#tray.setContextMenu(contextMenu);

      // 单击/双击托盘图标切换窗口显示或隐藏
      this.#tray.on('click', () => {
        this.toggleMainWindow();
      });

      this.#tray.on('double-click', () => {
        this.restoreMainWindow();
      });

      return this.#tray;
    } catch (err) {
      this.#logger.error('Failed to initialize tray:', err);
      return null;
    }
  }

  public toggleMainWindow(): void {
    const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
    if (!win) {
      this.restoreMainWindow();
      return;
    }
    if (win.isVisible() && !win.isMinimized()) {
      win.hide();
    } else {
      this.restoreMainWindow();
    }
  }

  public restoreMainWindow(): void {
    const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
    if (win) {
      if (win.isMinimized()) {
        win.restore();
      }
      win.show();
      win.focus();
    }
  }

  #resolveIconPath(): string {
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    const iconNames: string[] = [];
    if (isWin) {
      iconNames.push('icon.ico', 'icon.png');
    } else if (isMac) {
      iconNames.push('iconTemplate.png', 'icon.png');
    } else {
      iconNames.push('icon.png');
    }

    const baseDirs: string[] = [];
    if (process.resourcesPath) {
      baseDirs.push(path.join(process.resourcesPath, 'buildResources'));
    }
    if (app) {
      baseDirs.push(path.join(app.getAppPath(), 'build', 'resources'));
    }
    baseDirs.push(path.join(process.cwd(), 'build', 'resources'));

    for (const dir of baseDirs) {
      for (const name of iconNames) {
        const candidate = path.join(dir, name);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
    return '';
  }

  public destroy(): void {
    if (this.#tray) {
      this.#tray.destroy();
      this.#tray = null;
    }
  }
}

export function createTrayModule(): TrayManager {
  return new TrayManager();
}
