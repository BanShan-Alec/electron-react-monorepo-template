import type { OpenDirectoryInput, OpenFileInput, SaveFileInput } from '@app/shared/schemas/dialog';
import type { FileDialogResult, SaveFileDialogResult } from '@app/shared/types/dialog';
import { BrowserWindow, dialog, shell } from 'electron';

export class DialogService {
  async openFile(input?: OpenFileInput): Promise<FileDialogResult> {
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const properties: ('openFile' | 'multiSelections')[] = ['openFile'];
    if (input?.multiSelections) {
      properties.push('multiSelections');
    }

    const result = await dialog.showOpenDialog(window, {
      title: input?.title,
      filters: input?.filters,
      properties,
    });

    return {
      canceled: result.canceled,
      filePaths: result.filePaths,
    };
  }

  async openDirectory(input?: OpenDirectoryInput): Promise<FileDialogResult> {
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(window, {
      title: input?.title,
      properties: ['openDirectory'],
    });

    return {
      canceled: result.canceled,
      filePaths: result.filePaths,
    };
  }

  async saveFile(input?: SaveFileInput): Promise<SaveFileDialogResult> {
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const result = await dialog.showSaveDialog(window, {
      title: input?.title,
      defaultPath: input?.defaultPath,
      filters: input?.filters,
    });

    return {
      canceled: result.canceled,
      filePath: result.filePath,
    };
  }

  async showItemInFolder(path: string): Promise<void> {
    shell.showItemInFolder(path);
  }
}

export const dialogService = new DialogService();
