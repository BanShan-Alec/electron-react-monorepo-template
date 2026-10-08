import log from 'electron-log/main';
import type { AppInitConfig } from './AppInitConfig';
import { createModuleRunner } from './ModuleRunner';
import { terminateAppOnLastWindowClose } from './modules/auto-terminate.module';
import { createConfigModule, getAppConfigStore } from './modules/config.module';
import { createIPCModule } from './modules/ipc.module';
import { createLogModule } from './modules/log.module';
import { createNativeThemeModule } from './modules/native-theme.module';
import { allowInternalOrigins } from './modules/security/block-origins';
import { allowExternalUrls } from './modules/security/external-urls';
import { disallowMultipleAppInstance } from './modules/single-instance.module';
import { createStartupReadinessModule } from './modules/startup-readiness.module';
import { createTrayModule } from './modules/tray.module';
import { createWindowManagerModule } from './modules/window/index.module';
import { createUpdaterWindowModule } from './modules/window/updater-window.module';
import { updaterService } from './services/updater.service';

export async function initApp(initConfig: AppInitConfig) {
  const moduleRunner = createModuleRunner()
    .init(createLogModule())
    .init(createConfigModule())
    .init(createNativeThemeModule())
    .init(createIPCModule())
    // 主进程就绪源：链位在 WindowManager 之前，信号先于窗口与壳（spec §4.6 / ADR-0003）
    .init(createStartupReadinessModule())
    .init(createWindowManagerModule({ initConfig }))
    .init(createUpdaterWindowModule({ initConfig }))
    .init(createTrayModule())
    .init(disallowMultipleAppInstance())
    .init(terminateAppOnLastWindowClose())

    // Security
    .init(
      allowInternalOrigins(
        new Set(initConfig.windows.home instanceof URL ? [initConfig.windows.home.origin] : []),
      ),
    )
    .init(
      allowExternalUrls(new Set(['https://github.com', 'https://vite.dev', 'https://react.dev'])),
    );

  await moduleRunner;

  // 应用就绪后若开启自动更新则延迟执行后台静默检查
  try {
    const configStore = getAppConfigStore();
    if (configStore.get('autoCheckUpdate')) {
      setTimeout(() => {
        updaterService.checkSilently().catch((err) => {
          log.warn('[AutoUpdater] Silent update check failed:', err);
        });
      }, 3000);
    }
  } catch (err) {
    log.warn('[AutoUpdater] Failed to schedule silent update check:', err);
  }
}

// 自动引导启动主进程流水线
const devServer =
  process.env.MODE === 'development' && process.env.VITE_DEV_SERVER_URL
    ? process.env.VITE_DEV_SERVER_URL
    : undefined;

initApp({
  windows: {
    home: devServer ? new URL(devServer) : { path: require.resolve('@app/renderer') },
    updater: devServer
      ? new URL(`${devServer.endsWith('/') ? devServer : `${devServer}/`}updater.html`)
      : { path: require.resolve('@app/renderer/updater.html') },
  },
  preload: {
    path: require.resolve('@app/preload'),
  },
  // 初始化失败只经 electron-log 记入 main.log，不弹窗不退出
}).catch((error) => {
  log.error('[initAppFailed]', error);
});
