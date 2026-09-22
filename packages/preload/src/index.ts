import { IPC_CHANNELS } from '@app/shared/constants/ipc-channels';
import type { CalculateInput } from '@app/shared/schemas/calculator';
import type { UpdateConfigInput } from '@app/shared/schemas/config';
import type { StepInput } from '@app/shared/schemas/counter';
import type { LogInput, PerformActionInput } from '@app/shared/schemas/diagnostics';
import type { OpenDirectoryInput, OpenFileInput, SaveFileInput } from '@app/shared/schemas/dialog';
import type { ShowItemInFolderInput } from '@app/shared/schemas/shell';
import type { ElectronApi } from '@app/shared/types/api';
import { contextBridge, ipcRenderer, webUtils } from 'electron';

export const apiBridge: ElectronApi = {
  system: {
    ping: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_PING),
    getSystemInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_INFO),
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
  },
  // 遵循 specs-electron-fullstack / renderer/ipc-consumption.md 安全规范
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld('api', apiBridge);
