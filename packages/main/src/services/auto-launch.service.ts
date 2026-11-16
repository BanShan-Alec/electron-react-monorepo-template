import type { LoginItemStatus } from '@app/shared/types/system';
import { app } from 'electron';
import { isPackaged } from '../env';
import { getAppConfigStore } from '../modules/config.module';
import { getLogManager } from '../modules/log.module';

export class AutoLaunchService {
  private readonly logger = getLogManager().scoped(this);

  /**
   * 获取底层系统自启状态及是否被系统/任务管理器禁用
   */
  getLoginItemStatus(expectedOpenAtLogin?: boolean): LoginItemStatus {
    try {
      const settings = app.getLoginItemSettings({ args: ['--hidden'] });
      const configOpenAtLogin = expectedOpenAtLogin ?? getAppConfigStore().get('openAtLogin');

      let isBlockedBySystem = false;
      if (isPackaged && configOpenAtLogin) {
        // Windows 平台：若在任务管理器中被禁用，executableWillLaunchAtLogin 为 false
        if (
          process.platform === 'win32' &&
          settings.openAtLogin &&
          settings.executableWillLaunchAtLogin === false
        ) {
          isBlockedBySystem = true;
        } else if (
          process.platform === 'darwin' &&
          (settings as unknown as { status?: string }).status === 'requires-approval'
        ) {
          isBlockedBySystem = true;
        }
      }

      if (isBlockedBySystem) {
        this.logger.warn(
          'Startup item is enabled in app config, but is disabled or blocked by the operating system/task manager.',
        );
      }

      return {
        openAtLogin: settings.openAtLogin,
        isBlockedBySystem,
      };
    } catch (err) {
      this.logger.warn('Failed to get login item settings from OS:', err);
      return {
        openAtLogin: false,
        isBlockedBySystem: false,
      };
    }
  }

  /**
   * 向操作系统注册或取消开机自启
   */
  setOpenAtLogin(openAtLogin: boolean): void {
    if (!isPackaged) {
      this.logger.info(
        'Development mode (!app.isPackaged); skipping actual OS startup registration:',
        { openAtLogin },
      );
      return;
    }

    try {
      const settings: Parameters<typeof app.setLoginItemSettings>[0] = {
        openAtLogin,
        ...(process.platform === 'win32' ? { args: openAtLogin ? ['--hidden'] : [] } : {}),
      };
      app.setLoginItemSettings(settings);
      this.logger.info('Updated OS login item settings:', { openAtLogin });
    } catch (err) {
      this.logger.error('Failed to update OS login item settings:', err);
      throw new Error(
        `Failed to update system login item settings: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 应用启动时的静默校验与警告日志
   */
  checkStartupStatus(expectedOpenAtLogin?: boolean): void {
    if (!isPackaged) return;
    const configOpenAtLogin = expectedOpenAtLogin ?? getAppConfigStore().get('openAtLogin');
    if (!configOpenAtLogin) return;

    const status = this.getLoginItemStatus(configOpenAtLogin);
    if (status.isBlockedBySystem) {
      this.logger.warn(
        'Startup item is enabled in app config, but is disabled or blocked by the operating system/task manager.',
      );
    }
  }
}

export const autoLaunchService = new AutoLaunchService();
