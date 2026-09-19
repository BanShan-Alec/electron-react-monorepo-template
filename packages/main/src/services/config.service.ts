import type { AppConfig, UpdateConfigInput } from '@app/shared';
import { getAppConfigStore } from '../modules/config.module';
import { getLogManager } from '../modules/log.module';

export class ConfigService {
  getConfig(): AppConfig {
    return getAppConfigStore().getAll();
  }

  updateConfig(input: UpdateConfigInput): AppConfig {
    const updated = getAppConfigStore().set(input);
    getLogManager().mainLogger.info('[Config] App config updated:', input);
    return updated;
  }

  resetConfig(): AppConfig {
    const reset = getAppConfigStore().reset();
    getLogManager().mainLogger.info('[Config] App config reset to defaults');
    return reset;
  }
}

export const configService = new ConfigService();
