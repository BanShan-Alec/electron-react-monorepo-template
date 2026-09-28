import type { AppModule } from '../AppModule';
import type { ModuleContext } from '../ModuleContext';
import { updaterService } from '../services/updater.service';

export class ApplicationTerminatorOnLastWindowClose implements AppModule {
  enable({ app }: ModuleContext): Promise<void> | void {
    app.on('window-all-closed', () => {
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
