import { IPC_CHANNELS } from '@app/shared/constants/ipc-channels';
import type { CalculateInput } from '@app/shared/schemas/calculator';
import type { AppConfig, UpdateConfigInput } from '@app/shared/schemas/config';
import type { StepInput } from '@app/shared/schemas/counter';
import type { LogInput, PerformActionInput } from '@app/shared/schemas/diagnostics';
import type { OpenDirectoryInput, OpenFileInput, SaveFileInput } from '@app/shared/schemas/dialog';
import type { ShowItemInFolderInput } from '@app/shared/schemas/shell';
import type { ElectronApi } from '@app/shared/types/api';
import type { UpdaterProgress, UpdaterSnapshot } from '@app/shared/types/updater';
import { contextBridge, ipcRenderer, webUtils } from 'electron';

export const apiBridge: ElectronApi = {
  system: {
    ping: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_PING),
    getSystemInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_INFO),
    getPlatform: () => process.platform,
  },
  counter: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.COUNTER_GET),
    increment: (input?: StepInput) => ipcRenderer.invoke(IPC_CHANNELS.COUNTER_INCREMENT, input),
    decrement: (input?: StepInput) => ipcRenderer.invoke(IPC_CHANNELS.COUNTER_DECREMENT, input),
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.COUNTER_RESET),
  },
  calculator: {
    calculate: (input: CalculateInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.CALCULATOR_CALCULATE, input),
  },
  config: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET),
    update: (input: UpdateConfigInput) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_UPDATE, input),
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_RESET),
    onChanged: (cb: (config: AppConfig) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, config: AppConfig) => cb(config);
      ipcRenderer.on(IPC_CHANNELS.CONFIG_EVENT_CHANGED, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.CONFIG_EVENT_CHANGED, listener);
      };
    },
  },
  diagnostics: {
    log: (input: LogInput) => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_LOG, input),
    openLogFolder: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_OPEN_LOG_FOLDER),
    performAction: (input: PerformActionInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_PERFORM_ACTION, input),
  },
  dialog: {
    openFile: (input?: OpenFileInput) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, input),
    openDirectory: (input?: OpenDirectoryInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY, input),
    saveFile: (input?: SaveFileInput) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, input),
  },
  shell: {
    showItemInFolder: (input: ShowItemInFolderInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.SHELL_SHOW_ITEM_IN_FOLDER, input),
    openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url),
  },
  updater: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_GET_STATE),
    check: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_CHECK),
    download: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_DOWNLOAD),
    cancel: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_CANCEL),
    install: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_INSTALL),
    openWindow: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_OPEN_WINDOW),
    closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_CLOSE_WINDOW),
    onStateChanged: (cb: (s: UpdaterSnapshot) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, s: UpdaterSnapshot) => cb(s);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_EVENT_STATE, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_EVENT_STATE, listener);
      };
    },
    onProgressChanged: (cb: (p: UpdaterProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, p: UpdaterProgress) => cb(p);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_EVENT_PROGRESS, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_EVENT_PROGRESS, listener);
      };
    },
  },
  // 遵循 specs-electron-fullstack / renderer/ipc-consumption.md 安全规范
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld('api', apiBridge);
