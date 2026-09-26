import fs from 'node:fs';
import path from 'node:path';
import { app, dialog } from 'electron';
import type { AppInitConfig } from './AppInitConfig';
import { createModuleRunner } from './ModuleRunner';
import { terminateAppOnLastWindowClose } from './modules/auto-terminate.module';
import { autoUpdater } from './modules/auto-updater.module';
import { createConfigModule } from './modules/config.module';
import { hardwareAccelerationMode } from './modules/hardware-acceleration.module';
import { createIPCModule } from './modules/ipc.module';
import { createLogModule } from './modules/log.module';
import { createNativeThemeModule } from './modules/native-theme.module';
import { allowInternalOrigins } from './modules/security/block-origins';
import { allowExternalUrls } from './modules/security/external-urls';
import { disallowMultipleAppInstance } from './modules/single-instance.module';
import { createTrayModule } from './modules/tray.module';
import { createWindowManagerModule } from './modules/window/index.module';

/**
 * 致命错误同步落盘与系统原生弹窗告警 (跨全生命周期，包括生产打包态)
 */
function handleFatalCrash(type: string, error: unknown): void {
  const errorDetails = error instanceof Error ? error.stack || error.message : String(error);
  const logContent = `\n[FATAL CRASH] [${new Date().toISOString()}] [${type}]\n${errorDetails}\n`;

  console.error(logContent);

  try {
    const logDir = path.join(app?.getPath?.('userData') || process.cwd(), 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'fatal-crash.log'), logContent, 'utf8');
  } catch {
    try {
      fs.appendFileSync(path.join(process.cwd(), 'fatal-crash.log'), logContent, 'utf8');
    } catch {}
  }

  dialog.showErrorBox(
    'Application Initialization Error',
    `A critical error occurred while starting the application:\n\n${errorDetails}\n\nPlease check fatal-crash.log for details.`,
  );

  process.exit(1);
}

// 全生命周期监听未捕获异常与未处理 Promise 拒绝
process.on('uncaughtException', (err) => handleFatalCrash('uncaughtException', err));
process.on('unhandledRejection', (reason) => handleFatalCrash('unhandledRejection', reason));

export async function initApp(initConfig: AppInitConfig) {
  const isDev = process.env.NODE_ENV !== 'production';
  const moduleRunner = createModuleRunner()
    .init(createLogModule())
    .init(createConfigModule())
    .init(createNativeThemeModule())
    .init(createIPCModule())
    .init(createWindowManagerModule({ initConfig }))
    .init(createTrayModule())
    .init(disallowMultipleAppInstance())
    .init(terminateAppOnLastWindowClose())
    .init(hardwareAccelerationMode({ enable: false }))
    .init(autoUpdater())

    // Security
    .init(
      allowInternalOrigins(
        new Set(initConfig.renderer instanceof URL ? [initConfig.renderer.origin] : []),
      ),
    )
    .init(
      allowExternalUrls(new Set(['https://github.com', 'https://vite.dev', 'https://react.dev'])),
    );

  await moduleRunner;
}

// 自动引导启动主进程流水线
initApp({
  renderer:
    process.env.MODE === 'development' && process.env.VITE_DEV_SERVER_URL
      ? new URL(process.env.VITE_DEV_SERVER_URL)
      : {
          path: require.resolve('@app/renderer'),
        },

  preload: {
    path: require.resolve('@app/preload'),
  },
}).catch((error) => {
  handleFatalCrash('initAppFailed', error);
});
