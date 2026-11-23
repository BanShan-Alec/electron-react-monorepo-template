import type { AutoLaunchStatus } from '@app/shared/types/system';
import { app } from 'electron';
import { isPackaged } from '../env';
import { getAppConfigStore } from '../modules/config.module';
import { getLogManager } from '../modules/log.module';

/** Electron 仅在 darwin/win32 实现登录项 API（electron.d.ts: @platform darwin,win32） */
function isAutoLaunchSupported(): boolean {
  return process.platform === 'win32' || process.platform === 'darwin';
}

export class AutoLaunchService {
  private readonly logger = getLogManager().scoped(this);

  /**
   * 获取开机自启状态：平台能力、系统侧启用状态与被系统拦截的标记
   */
  getAutoLaunchStatus(expectedAutoLaunch?: boolean): AutoLaunchStatus {
    const configAutoLaunch = expectedAutoLaunch ?? getAppConfigStore().get('autoLaunch');

    // 不支持的平台无系统状态可查：如实上报能力，启用态回显配置意图，不虚构「被系统禁用」
    if (!isAutoLaunchSupported()) {
      return { isSupported: false, isEnabled: configAutoLaunch, isBlockedBySystem: false };
    }

    try {
      const settings = app.getLoginItemSettings({ args: ['--hidden'] });

      let isBlockedBySystem = false;
      let blockedReason = '';
      if (isPackaged && configAutoLaunch) {
        if (!settings.openAtLogin) {
          // 配置开着但系统里查不到：启动项被 Windows 设置或清理工具移除
          isBlockedBySystem = true;
          blockedReason = 'Startup item is missing from the operating system.';
        } else if (
          // Windows 平台：若在任务管理器中被禁用，executableWillLaunchAtLogin 为 false
          process.platform === 'win32' &&
          settings.executableWillLaunchAtLogin === false
        ) {
          isBlockedBySystem = true;
          blockedReason = 'Startup item is disabled by the task manager.';
        } else if (
          process.platform === 'darwin' &&
          (settings as unknown as { status?: string }).status === 'requires-approval'
        ) {
          isBlockedBySystem = true;
          blockedReason = 'Startup item requires user approval in system settings.';
        }
      }

      if (isBlockedBySystem) {
        this.logger.warn(
          `Auto-launch is enabled in app config, but is blocked by the operating system: ${blockedReason}`,
        );
      }

      return {
        isSupported: true,
        isEnabled: settings.openAtLogin,
        isBlockedBySystem,
      };
    } catch (err) {
      this.logger.warn('Failed to get login item settings from OS:', err);
      return {
        isSupported: true,
        isEnabled: false,
        isBlockedBySystem: false,
      };
    }
  }

  /**
   * 向操作系统注册或取消开机自启
   */
  setAutoLaunch(autoLaunch: boolean): void {
    if (!isPackaged) {
      this.logger.info(
        'Development mode (!app.isPackaged); skipping actual OS startup registration:',
        { autoLaunch },
      );
      return;
    }

    if (!isAutoLaunchSupported()) {
      this.logger.info(
        'Login item API is not available on this platform; skipping OS startup registration:',
        { autoLaunch },
      );
      return;
    }

    try {
      const settings: Parameters<typeof app.setLoginItemSettings>[0] = {
        openAtLogin: autoLaunch,
        ...(process.platform === 'win32' ? { args: autoLaunch ? ['--hidden'] : [] } : {}),
      };
      app.setLoginItemSettings(settings);
      this.logger.info('Updated OS login item settings:', { autoLaunch });
    } catch (err) {
      this.logger.error('Failed to update OS login item settings:', err);
      throw new Error(
        `Failed to update system login item settings: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 应用启动时的静默校验：仅触发一次状态查询，告警由 getAutoLaunchStatus 统一输出
   */
  checkStartupStatus(expectedAutoLaunch?: boolean): void {
    if (!isPackaged) return;
    const configAutoLaunch = expectedAutoLaunch ?? getAppConfigStore().get('autoLaunch');
    if (!configAutoLaunch) return;

    this.getAutoLaunchStatus(configAutoLaunch);
  }
}

export const autoLaunchService = new AutoLaunchService();
