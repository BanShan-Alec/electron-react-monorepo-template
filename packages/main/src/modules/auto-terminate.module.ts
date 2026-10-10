import type { AppModule } from '../AppModule';
import { appLifecycle } from '../lifecycle';
import type { ModuleContext } from '../ModuleContext';
import { updaterService } from '../services/updater.service';
import { getAppConfigStore } from './config.module';

export class ApplicationTerminatorOnLastWindowClose implements AppModule {
  enable({ app }: ModuleContext): Promise<void> | void {
    app.on('window-all-closed', () => {
      const configStore = getAppConfigStore();
      const shouldMinimizeToTray = configStore.get('minimizeToTray');

      // 开启了最小化到托盘且未处于退出态：主窗口销毁后应用常驻系统托盘，阻止自动退出
      if (!appLifecycle.isQuitting && shouldMinimizeToTray) {
        return;
      }

      // 结合 updater 运行态判定退出策略（防僵尸进程）
      const updaterState = updaterService.getState();
      if (updaterState !== 'downloading') {
        app.quit();
      }
    });
  }
}

export function terminateAppOnLastWindowClose(
  ...args: ConstructorParameters<typeof ApplicationTerminatorOnLastWindowClose>
) {
  return new ApplicationTerminatorOnLastWindowClose(...args);
}
