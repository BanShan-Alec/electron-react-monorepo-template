import type { AppModule } from '../AppModule';
import { registerAllControllers } from '../controllers';
import type { ModuleContext } from '../ModuleContext';
import { getLogManager } from './log.module';

export class IPCModule implements AppModule {
  enable(_context: ModuleContext): void {
    const logger = getLogManager().mainLogger;
    logger.info('[IPCModule] Registering all controllers according to fullstack specs...');
    registerAllControllers();
    logger.info('[IPCModule] All IPC controllers registered successfully.');
  }
}

export function createIPCModule(): AppModule {
  return new IPCModule();
}
