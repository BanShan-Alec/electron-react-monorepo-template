import { IPC_CHANNELS } from '@app/shared/constants/ipc-channels';
import { APP_STARTUP_MAIN_READY_EVENT } from '@app/shared/constants/startup';
import type { CalculateInput } from '@app/shared/schemas/calculator';
import type { AppConfig, UpdateConfigInput } from '@app/shared/schemas/config';
import type { StepInput } from '@app/shared/schemas/counter';
import type { LogInput, PerformActionInput } from '@app/shared/schemas/diagnostics';
import type { OpenDirectoryInput, OpenFileInput, SaveFileInput } from '@app/shared/schemas/dialog';
import type { ShowItemInFolderInput } from '@app/shared/schemas/shell';
import type { ElectronApi } from '@app/shared/types/api';
import type { StartupGateSnapshot, StartupMainReadyPayload } from '@app/shared/types/startup';
import type { UpdaterProgress, UpdaterSnapshot } from '@app/shared/types/updater';
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { invokeTraced } from './telemetry/ipc-tracer';

// 启动就绪桥（spec §4.6 / ADR-0003）：先拉后推，主进程信号先于窗口时经快照补发不丢。
// 求值时即预取快照并注册推送监听（不等 onMainReady 被调用）——晚到信号经跨世界
// 纯 Event 派发给壳协调器（contextIsolation 下无 payload Event 可见），payload 经回调携带
const mainReadyCallbacks = new Set<(payload: StartupMainReadyPayload) => void>();
const startupSnapshotPromise = invokeTraced<StartupGateSnapshot>(IPC_CHANNELS.STARTUP_GET_SNAPSHOT);
ipcRenderer.on(
  IPC_CHANNELS.STARTUP_EVENT_MAIN_READY,
  (_event, payload: StartupMainReadyPayload) => {
    window.dispatchEvent(new Event(APP_STARTUP_MAIN_READY_EVENT));
    for (const cb of mainReadyCallbacks) cb(payload);
  },
);

export const apiBridge: ElectronApi = {
  system: {
    ping: () => invokeTraced(IPC_CHANNELS.SYSTEM_PING),
    getSystemInfo: () => invokeTraced(IPC_CHANNELS.SYSTEM_GET_INFO),
    getPlatform: () => process.platform,
  },
  counter: {
    get: () => invokeTraced(IPC_CHANNELS.COUNTER_GET),
    increment: (input?: StepInput) => invokeTraced(IPC_CHANNELS.COUNTER_INCREMENT, input),
    decrement: (input?: StepInput) => invokeTraced(IPC_CHANNELS.COUNTER_DECREMENT, input),
    reset: () => invokeTraced(IPC_CHANNELS.COUNTER_RESET),
  },
  calculator: {
    calculate: (input: CalculateInput) => invokeTraced(IPC_CHANNELS.CALCULATOR_CALCULATE, input),
  },
  config: {
    get: () => invokeTraced(IPC_CHANNELS.CONFIG_GET),
    update: (input: UpdateConfigInput) => invokeTraced(IPC_CHANNELS.CONFIG_UPDATE, input),
    reset: () => invokeTraced(IPC_CHANNELS.CONFIG_RESET),
    onChanged: (cb: (config: AppConfig) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, config: AppConfig) => cb(config);
      ipcRenderer.on(IPC_CHANNELS.CONFIG_EVENT_CHANGED, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.CONFIG_EVENT_CHANGED, listener);
      };
    },
  },
  diagnostics: {
    log: (input: LogInput) => invokeTraced(IPC_CHANNELS.DIAGNOSTICS_LOG, input),
    openLogFolder: () => invokeTraced(IPC_CHANNELS.DIAGNOSTICS_OPEN_LOG_FOLDER),
    performAction: (input: PerformActionInput) =>
      invokeTraced(IPC_CHANNELS.DIAGNOSTICS_PERFORM_ACTION, input),
  },
  dialog: {
    openFile: (input?: OpenFileInput) => invokeTraced(IPC_CHANNELS.DIALOG_OPEN_FILE, input),
    openDirectory: (input?: OpenDirectoryInput) =>
      invokeTraced(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY, input),
    saveFile: (input?: SaveFileInput) => invokeTraced(IPC_CHANNELS.DIALOG_SAVE_FILE, input),
  },
  shell: {
    showItemInFolder: (input: ShowItemInFolderInput) =>
      invokeTraced(IPC_CHANNELS.SHELL_SHOW_ITEM_IN_FOLDER, input),
    openExternal: (url: string) => invokeTraced(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url),
  },
  updater: {
    getState: () => invokeTraced(IPC_CHANNELS.UPDATER_GET_STATE),
    check: () => invokeTraced(IPC_CHANNELS.UPDATER_CHECK),
    download: () => invokeTraced(IPC_CHANNELS.UPDATER_DOWNLOAD),
    cancel: () => invokeTraced(IPC_CHANNELS.UPDATER_CANCEL),
    install: () => invokeTraced(IPC_CHANNELS.UPDATER_INSTALL),
    openWindow: () => invokeTraced(IPC_CHANNELS.UPDATER_OPEN_WINDOW),
    closeWindow: () => invokeTraced(IPC_CHANNELS.UPDATER_CLOSE_WINDOW),
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
  // 启动就绪桥（spec §4.6 / ADR-0003）：快照走求值期预取的 Promise，推送回调按注册表分发
  startup: {
    getSnapshot: () => startupSnapshotPromise,
    onMainReady: (cb: (payload: StartupMainReadyPayload) => void) => {
      mainReadyCallbacks.add(cb);
      return () => {
        mainReadyCallbacks.delete(cb);
      };
    },
  },
  // 遵循 specs-electron-fullstack / renderer/ipc-consumption.md 安全规范
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  invokeTraced,
};

contextBridge.exposeInMainWorld('api', apiBridge);
