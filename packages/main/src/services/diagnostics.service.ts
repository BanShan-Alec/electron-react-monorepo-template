import { type ActionResult, ErrorCode, type LogInput, type PerformActionInput } from '@app/shared';
import { BrowserWindow, shell } from 'electron';
import { AppError } from '../errors/AppError';
import { getLogManager } from '../modules/log.module';

export class DiagnosticsService {
  logMessage(input: LogInput): void {
    getLogManager().logRendererMessage(input.level, input.message, input.meta);
  }

  async openLogFolder(): Promise<{ success: boolean; path: string }> {
    await getLogManager().openLogFolder();
    return { success: true, path: getLogManager().getLogDirectory() };
  }

  async performAction(input: PerformActionInput): Promise<ActionResult> {
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

    if (input.action === 'toggleDevTools') {
      if (!window) {
        throw new AppError('No active window found to toggle DevTools', ErrorCode.WINDOW_NOT_FOUND);
      }
      if (window.webContents.isDevToolsOpened()) {
        window.webContents.closeDevTools();
        return { success: true, message: 'DevTools closed' };
      } else {
        window.webContents.openDevTools();
        return { success: true, message: 'DevTools opened' };
      }
    }

    if (input.action === 'openUrl' && input.url) {
      const parsed = new URL(input.url);
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        throw new AppError(
          'Invalid URL protocol. Only http: and https: are allowed.',
          ErrorCode.INVALID_PROTOCOL,
        );
      }
      await shell.openExternal(input.url);
      return { success: true, message: `Opened ${input.url}` };
    }

    return { success: false, message: 'No action performed' };
  }
}

export const diagnosticsService = new DiagnosticsService();
