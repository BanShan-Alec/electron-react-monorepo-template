import type { AppConfig, UpdateConfigInput } from '@app/shared/schemas/config';
import { getAppConfigStore } from '../modules/config.module';
import { getLogManager } from '../modules/log.module';
import { applyNativeThemeSource } from '../modules/native-theme.module';
import { getTrayManager } from '../modules/tray.module';
import { autoLaunchService } from './auto-launch.service';

export class ConfigService {
  private readonly logger = getLogManager().scoped(this);

  getConfig(): AppConfig {
    return getAppConfigStore().getAll();
  }

  updateConfig(input: UpdateConfigInput): AppConfig {
    if (input.openAtLogin !== undefined) {
      // 开机自启变更优先同步底层操作系统；失败直接阻断落盘并由 Controller 向上抛出
      autoLaunchService.setOpenAtLogin(input.openAtLogin);
    }
    const updated = getAppConfigStore().set(input);
    if (input.theme !== undefined) {
      // 主题偏好变更即时同步系统级主题（nativeTheme），无需重启即原生 UI 生效
      applyNativeThemeSource(input.theme);
    }
    if (input.language !== undefined) {
      // 语言偏好变更即时同步托盘菜单文案
      getTrayManager().updateLanguage(input.language);
    }
    this.logger.info('App config updated:', input);
    return updated;
  }

  resetConfig(): AppConfig {
    // 恢复默认配置时联动清除底层操作系统自启项
    autoLaunchService.setOpenAtLogin(false);
    const reset = getAppConfigStore().reset();
    // 恢复到默认主题偏好，同样需要同步 themeSource 与系统托盘语言
    applyNativeThemeSource(reset.theme);
    getTrayManager().updateLanguage(reset.language);
    this.logger.info('App config reset to defaults');
    return reset;
  }
}

export const configService = new ConfigService();
