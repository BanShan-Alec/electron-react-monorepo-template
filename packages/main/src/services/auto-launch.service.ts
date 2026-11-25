import type { AutoLaunchStatus, AutoLaunchUnsupportedReason } from '@app/shared/types/system';
import { app } from 'electron';
import { isInstalledCopy } from '../env';
import { getAppConfigStore } from '../modules/config.module';
import { getLogManager } from '../modules/log.module';

/**
 * AutoLaunchService 可注入依赖
 *
 * 默认实现面向真实运行环境；测试通过注入覆盖平台能力与副本形态判定，
 * 由公开 API 驱动验证，不把内部判定抽离成外部微型函数。
 */
export interface AutoLaunchServiceDeps {
  /** 平台是否提供登录项 API（默认 win32 / darwin） */
  isPlatformSupported?: () => boolean;
  /** 当前是否为安装版副本（默认判定可执行文件是否落在构建时的仓库目录内） */
  isInstalledCopy?: () => boolean;
}

export class AutoLaunchService {
  private readonly logger = getLogManager().scoped(this);
  private readonly resolvePlatformSupported: () => boolean;
  private readonly resolveInstalledCopy: () => boolean;

  constructor(deps: AutoLaunchServiceDeps = {}) {
    this.resolvePlatformSupported =
      deps.isPlatformSupported ??
      (() => process.platform === 'win32' || process.platform === 'darwin');
    this.resolveInstalledCopy = deps.isInstalledCopy ?? isInstalledCopy;
  }

  /**
   * 本副本能否管理操作系统登录项；不可用时给出具体原因，供渲染层区分文案
   */
  getUnsupportedReason(): AutoLaunchUnsupportedReason {
    if (!this.resolvePlatformSupported()) return 'platform';
    if (!this.resolveInstalledCopy()) return 'unpacked-copy';
    return null;
  }

  /**
   * 获取开机自启状态：平台能力、副本资格、系统侧启用状态与被系统拦截的标记
   */
  getAutoLaunchStatus(expectedAutoLaunch?: boolean): AutoLaunchStatus {
    const configAutoLaunch = expectedAutoLaunch ?? getAppConfigStore().get('autoLaunch');
    const unsupportedReason = this.getUnsupportedReason();

    // 不可管理时无系统状态可查：如实上报能力与原因，启用态回显配置意图，不虚构「被系统禁用」
    if (unsupportedReason !== null) {
      return {
        isSupported: false,
        isEnabled: configAutoLaunch,
        isBlockedBySystem: false,
        unsupportedReason,
      };
    }

    try {
      const settings = app.getLoginItemSettings({ args: ['--hidden'] });

      let isBlockedBySystem = false;
      let blockedReason = '';
      if (configAutoLaunch) {
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
        unsupportedReason: null,
      };
    } catch (err) {
      this.logger.warn('Failed to get login item settings from OS:', err);
      return {
        isSupported: true,
        isEnabled: false,
        isBlockedBySystem: false,
        unsupportedReason: null,
      };
    }
  }

  /**
   * 向操作系统注册或取消开机自启
   *
   * 收权铁律：只有安装版副本可以写系统登录项。免安装副本（build:unpack 解包目录、联调实例）
   * 与安装版共用同一个 AppUserModelId，写入会直接覆盖安装版的启动项，造成「开机拉起测试副本」。
   */
  setAutoLaunch(autoLaunch: boolean): void {
    const unsupportedReason = this.getUnsupportedReason();

    if (unsupportedReason !== null) {
      // 不做任何系统写操作，也不抛错：设置载入/reset 流程需要保持可用
      this.logger.info(
        `Skipping OS startup registration (${unsupportedReason === 'platform' ? 'platform without login item API' : 'not an installed copy'}):`,
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
    if (this.getUnsupportedReason() !== null) return;
    const configAutoLaunch = expectedAutoLaunch ?? getAppConfigStore().get('autoLaunch');
    if (!configAutoLaunch) return;

    this.getAutoLaunchStatus(configAutoLaunch);
  }
}

export const autoLaunchService = new AutoLaunchService();
