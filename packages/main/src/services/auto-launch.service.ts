import type { LoginItemStatus } from '@app/shared/types/system';
import { app } from 'electron';
import { isPackaged } from '../env';
import { getAppConfigStore } from '../modules/config.module';
import { getLogManager } from '../modules/log.module';

/** Electron 仅在 darwin/win32 实现登录项 API（electron.d.ts: @platform darwin,win32） */
function isLoginItemSupported(): boolean {
  return process.platform === 'win32' || process.platform === 'darwin';
}

export class AutoLaunchService {
  private readonly logger = getLogManager().scoped(this);

  /**
   * 获取底层系统自启状态及是否被系统/任务管理器禁用
   */
  getLoginItemStatus(expectedOpenAtLogin?: boolean): LoginItemStatus {
    const configOpenAtLogin = expectedOpenAtLogin ?? getAppConfigStore().get('openAtLogin');

    // 不支持的平台如实回显配置意图，不虚构 OS 状态（否则会永久误报「被系统禁用」）
    if (!isLoginItemSupported()) {
      return { openAtLogin: configOpenAtLogin, isBlockedBySystem: false };
    }

    try {
      const settings = app.getLoginItemSettings({ args: ['--hidden'] });

      let isBlockedBySystem = false;
      let blockedReason = '';
      if (isPackaged && configOpenAtLogin) {
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

    if (!isLoginItemSupported()) {
      this.logger.info(
        'Login item API is not available on this platform; skipping OS startup registration:',
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
   * 应用启动时的静默校验：仅触发一次状态查询，告警由 getLoginItemStatus 统一输出
   */
  checkStartupStatus(expectedOpenAtLogin?: boolean): void {
    if (!isPackaged) return;
    const configOpenAtLogin = expectedOpenAtLogin ?? getAppConfigStore().get('openAtLogin');
    if (!configOpenAtLogin) return;

    this.getLoginItemStatus(configOpenAtLogin);
  }
}

export const autoLaunchService = new AutoLaunchService();
