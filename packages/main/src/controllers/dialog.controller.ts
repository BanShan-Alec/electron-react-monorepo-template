import {
  ErrorCode,
  type FileDialogResult,
  IPC_CHANNELS,
  openDirectoryInputSchema,
  openFileInputSchema,
  type Result,
  type SaveFileDialogResult,
  saveFileInputSchema,
  showItemInFolderInputSchema,
} from '@app/shared';
import { ipcMain } from 'electron';
import { dialogService } from '../services/dialog.service';
import { catchToResult, failResult, successResult } from './utils';

export function registerDialogControllers(): void {
  ipcMain.handle(
    IPC_CHANNELS.DIALOG_OPEN_FILE,
    async (_event, rawInput: unknown): Promise<Result<FileDialogResult>> => {
      const parseResult = openFileInputSchema.safeParse(rawInput);
      if (!parseResult.success) {
        return failResult(parseResult.error.issues[0].message, ErrorCode.VALIDATION_ERROR);
      }
      try {
        const res = await dialogService.openFile(parseResult.data);
        return successResult(res);
      } catch (err) {
        return catchToResult(err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_OPEN_DIRECTORY,
    async (_event, rawInput: unknown): Promise<Result<FileDialogResult>> => {
      const parseResult = openDirectoryInputSchema.safeParse(rawInput);
      if (!parseResult.success) {
        return failResult(parseResult.error.issues[0].message, ErrorCode.VALIDATION_ERROR);
      }
      try {
        const res = await dialogService.openDirectory(parseResult.data);
        return successResult(res);
      } catch (err) {
        return catchToResult(err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_SAVE_FILE,
    async (_event, rawInput: unknown): Promise<Result<SaveFileDialogResult>> => {
      const parseResult = saveFileInputSchema.safeParse(rawInput);
      if (!parseResult.success) {
        return failResult(parseResult.error.issues[0].message, ErrorCode.VALIDATION_ERROR);
      }
      try {
        const res = await dialogService.saveFile(parseResult.data);
        return successResult(res);
      } catch (err) {
        return catchToResult(err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SHELL_SHOW_ITEM_IN_FOLDER,
    async (_event, rawInput: unknown): Promise<Result<{ success: boolean }>> => {
      const parseResult = showItemInFolderInputSchema.safeParse(rawInput);
      if (!parseResult.success) {
        return failResult(parseResult.error.issues[0].message, ErrorCode.VALIDATION_ERROR);
      }
      try {
        await dialogService.showItemInFolder(parseResult.data.path);
        return successResult({ success: true });
      } catch (err) {
        return catchToResult(err);
      }
    },
  );
}
