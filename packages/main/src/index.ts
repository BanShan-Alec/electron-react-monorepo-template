// 必须保持为第一个 import：先于其他所有模块求值时安装致命崩溃监听，接住 import 期异常
import './fatal-crash';
import log from 'electron-log/main';
import type { AppInitConfig } from './AppInitConfig';
import { createModuleRunner } from './ModuleRunner';
import { terminateAppOnLastWindowClose } from './modules/auto-terminate.module';
import { createConfigModule } from './modules/config.module';
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
  // 初始化失败只经 electron-log 记入 main.log，不弹窗不退出（fatal-crash 只兜 import 期与运行期同步崩溃）
}).catch((error) => {
  log.error('[initAppFailed]', error);
});
