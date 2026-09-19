import { URL } from 'node:url';
import { shell } from 'electron';
import type { AppModule } from '../../AppModule';
import type { ModuleContext } from '../../ModuleContext';
import { getLogManager } from '../log.module';

export class ExternalUrls implements AppModule {
  readonly #externalUrls: Set<string>;

  constructor(externalUrls: Set<string>) {
    this.#externalUrls = externalUrls;
  }

  enable({ app }: ModuleContext): Promise<void> | void {
    const isDev = process.env.NODE_ENV !== 'production';

    app.on('web-contents-created', (_, contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        try {
          const parsedUrl = new URL(url);

          // 仅允许安全的网络协议
          if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            if (isDev) {
              console.warn(`[ExternalUrls] Blocked non-http(s) protocol navigation: ${url}`);
            }
            return { action: 'deny' };
          }

          if (this.#externalUrls.has(parsedUrl.origin)) {
            shell.openExternal(url).catch((err) => {
              getLogManager().mainLogger.error('[ExternalUrls] Failed to open external URL:', err);
            });
          } else if (isDev) {
            console.warn(
              `Blocked the opening of a disallowed external origin: ${parsedUrl.origin}`,
            );
          }
        } catch (err) {
          getLogManager().mainLogger.warn(
            `[ExternalUrls] Malformed or invalid URL received: ${url}`,
            err,
          );
        }

        // Prevent creating a new window.
        return { action: 'deny' };
      });
    });
  }
}

export function allowExternalUrls(...args: ConstructorParameters<typeof ExternalUrls>) {
  return new ExternalUrls(...args);
}
