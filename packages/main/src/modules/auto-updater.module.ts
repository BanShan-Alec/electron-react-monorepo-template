import electronUpdater, { type AppUpdater } from 'electron-updater';
import type { AppModule } from '../AppModule';
import { getLogManager } from './log.module';

type DownloadNotification = Parameters<AppUpdater['checkForUpdatesAndNotify']>[0];

export class AutoUpdater implements AppModule {
  readonly #logger = getLogManager().scoped(this);
  readonly #notification: DownloadNotification;

  constructor({
    downloadNotification = undefined,
  }: {
    downloadNotification?: DownloadNotification;
  } = {}) {
    this.#notification = downloadNotification;
  }

  async enable(): Promise<void> {
    await this.runAutoUpdater();
  }

  getAutoUpdater(): AppUpdater {
    // Using destructuring to access autoUpdater due to the CommonJS module of 'electron-updater'.
    // It is a workaround for ESM compatibility issues, see https://github.com/electron-userland/electron-builder/issues/7976.
    const { autoUpdater } = electronUpdater;
    return autoUpdater;
  }

  async runAutoUpdater() {
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }

    const updater = this.getAutoUpdater();
    try {
      updater.logger = this.#logger;
      updater.fullChangelog = true;

      if (process.env.VITE_DISTRIBUTION_CHANNEL) {
        updater.channel = process.env.VITE_DISTRIBUTION_CHANNEL;
      }

      return await updater.checkForUpdatesAndNotify(this.#notification);
    } catch (error) {
      this.#logger.warn('Failed to check for updates:', error);
      return null;
    }
  }
}

export function autoUpdater(...args: ConstructorParameters<typeof AutoUpdater>) {
  return new AutoUpdater(...args);
}
