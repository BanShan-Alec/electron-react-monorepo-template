import { ErrorCode } from '@app/shared/constants/error-codes';
import { IPC_CHANNELS } from '@app/shared/constants/ipc-channels';
import { type AppConfig, updateConfigInputSchema } from '@app/shared/schemas/config';
import type { Result } from '@app/shared/types/result';
import { ipcMain } from 'electron';
import { configService } from '../services/config.service';
import { catchToResult, failResult, successResult } from './utils';

export function registerConfigControllers(): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async (): Promise<Result<AppConfig>> => {
    try {
      return successResult(configService.getConfig());
    } catch (err) {
      return catchToResult(err);
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_UPDATE,
    async (_event, rawInput: unknown): Promise<Result<AppConfig>> => {
      const parseResult = updateConfigInputSchema.safeParse(rawInput);
      if (!parseResult.success) {
        return failResult(parseResult.error.issues[0].message, ErrorCode.VALIDATION_ERROR);
      }
      try {
        return successResult(configService.updateConfig(parseResult.data));
      } catch (err) {
        return catchToResult(err);
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.CONFIG_RESET, async (): Promise<Result<AppConfig>> => {
    try {
      return successResult(configService.resetConfig());
    } catch (err) {
      return catchToResult(err);
    }
  });
}
