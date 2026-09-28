import fs from 'node:fs';
import path from 'node:path';
import { WINDOW_IDS } from '@app/shared/constants/windows';
import { app, Menu, nativeImage, Tray } from 'electron';
import type { AppModule } from '../AppModule';
import { appLifecycle } from '../lifecycle';
import type { ModuleContext } from '../ModuleContext';
import { updaterService } from '../services/updater.service';
import { getLogManager } from './log.module';
import { getUpdaterWindowModule } from './window/updater-window.module';
import { getWindow } from './window/window-registry';

export class TrayManager implements AppModule {
  private tray: Tray | null = null;
  private contextMenu: Menu | null = null;
  private readonly logger = getLogManager().scoped(this);

  public enable({ app: electronApp }: ModuleContext): void {
    electronApp.whenReady().then(() => {
      this.initTray();
    });
  }

  public getContextMenu(): Menu | null {
    return this.contextMenu;
  }

  public updateLanguage(lang: string): void {
    if (!this.tray) return;

    const isZh = lang === 'zh-CN';
    this.tray.setToolTip(
      isZh ? `${app.getName()} - 桌面客户端` : `${app.getName()} - Desktop Client`,
    );

    this.contextMenu = Menu.buildFromTemplate([
      {
        label: isZh ? '显示主窗口' : 'Show Main Window',
        click: () => this.restoreMainWindow(),
      },
      {
        label: isZh ? '检查更新' : 'Check for Updates',
        click: () => {
          this.logger.info('User requested update check');
          updaterService.check().catch((err) => {
            this.logger.warn('Failed to check for updates from tray:', err);
          });
          getUpdaterWindowModule()
            .show()
            .catch((err) => {
              this.logger.error('Failed to show updater window from tray:', err);
            });
        },
      },
      { type: 'separator' },
      {
        label: isZh ? '退出应用' : 'Quit Application',
        click: () => {
          appLifecycle.isQuitting = true;
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(this.contextMenu);
  }

  public initTray(): Tray | null {
    if (this.tray) return this.tray;

    try {
      const iconPath = this.resolveIconPath();
      let icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
      if (icon.isEmpty()) {
        icon = nativeImage.createEmpty();
      } else {
        if (process.platform === 'darwin') {
          icon.setTemplateImage(true);
        }
        icon = icon.resize({ width: 16, height: 16 });
      }

      this.tray = new Tray(icon);
      this.updateLanguage('zh-CN');

      // 单击/双击托盘图标切换窗口显示或隐藏
      this.tray.on('click', () => {
        this.toggleMainWindow();
      });

      this.tray.on('double-click', () => {
        this.restoreMainWindow();
      });

      return this.tray;
    } catch (err) {
      this.logger.error('Failed to initialize tray:', err);
      return null;
    }
  }

  public toggleMainWindow(): void {
    const win = getWindow(WINDOW_IDS.HOME);
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
    const win = getWindow(WINDOW_IDS.HOME);
    if (win) {
      if (win.isMinimized()) {
        win.restore();
      }
      win.show();
      win.focus();
    }
  }

  private resolveIconPath(): string {
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
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      this.contextMenu = null;
    }
  }
}

let singletonTrayManager: TrayManager | null = null;

export function getTrayManager(): TrayManager {
  if (!singletonTrayManager) {
    singletonTrayManager = new TrayManager();
  }
  (globalThis as unknown as { __trayManager?: TrayManager }).__trayManager = singletonTrayManager;
  return singletonTrayManager;
}

export function createTrayModule(): TrayManager {
  return getTrayManager();
}
