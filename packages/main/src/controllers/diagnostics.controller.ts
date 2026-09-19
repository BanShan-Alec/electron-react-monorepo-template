import {
  type ActionResult,
  ErrorCode,
  IPC_CHANNELS,
  logInputSchema,
  type OpenLogFolderResult,
  performActionInputSchema,
  type Result,
} from '@app/shared';
import { ipcMain } from 'electron';
import { diagnosticsService } from '../services/diagnostics.service';
import { catchToResult, failResult, successResult } from './utils';

export function registerDiagnosticsControllers(): void {
  ipcMain.handle(
    IPC_CHANNELS.DIAGNOSTICS_LOG,
    async (_event, rawInput: unknown): Promise<Result<{ success: boolean }>> => {
      const parseResult = logInputSchema.safeParse(rawInput);
      if (!parseResult.success) {
        return failResult(parseResult.error.issues[0].message, ErrorCode.VALIDATION_ERROR);
      }
      try {
        diagnosticsService.logMessage(parseResult.data);
        return successResult({ success: true });
      } catch (err) {
        return catchToResult(err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DIAGNOSTICS_OPEN_LOG_FOLDER,
    async (): Promise<Result<OpenLogFolderResult>> => {
      try {
        const res = await diagnosticsService.openLogFolder();
        return successResult(res);
      } catch (err) {
        return catchToResult(err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DIAGNOSTICS_PERFORM_ACTION,
    async (_event, rawInput: unknown): Promise<Result<ActionResult>> => {
      const parseResult = performActionInputSchema.safeParse(rawInput);
      if (!parseResult.success) {
        return failResult(parseResult.error.issues[0].message, ErrorCode.VALIDATION_ERROR);
      }
      try {
        const res = await diagnosticsService.performAction(parseResult.data);
        return successResult(res);
      } catch (err) {
        return catchToResult(err);
      }
    },
  );
}
