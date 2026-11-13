import type { CalculateInput } from '../schemas/calculator';
import type { CloseBehaviorChoice } from '../schemas/close-behavior';
import type { AppConfig, UpdateConfigInput } from '../schemas/config';
import type { StepInput } from '../schemas/counter';
import type { LogInput, PerformActionInput } from '../schemas/diagnostics';
import type { OpenDirectoryInput, OpenFileInput, SaveFileInput } from '../schemas/dialog';
import type { ShowItemInFolderInput } from '../schemas/shell';
import type { CalculateResult } from './calculator';
import type { CounterResult } from './counter';
import type { ActionResult, OpenLogFolderResult } from './diagnostics';
import type { FileDialogResult, SaveFileDialogResult } from './dialog';
import type { Result } from './result';
import type { PingResult, SystemInfo } from './system';
import type { IpcCallOptions } from './telemetry';
import type { UpdaterProgress, UpdaterSnapshot } from './updater';
import type { UsbDeviceItem } from './usb';

/**
 * Window.api 跨端统一契约接口 (ElectronApi)
 */
export interface ElectronApi {
  usb: {
    getDeviceList: (_payload?: void, options?: IpcCallOptions) => Promise<Result<UsbDeviceItem[]>>;
  };
  system: {
    ping: (_payload?: void, options?: IpcCallOptions) => Promise<Result<PingResult>>;
    getSystemInfo: (_payload?: void, options?: IpcCallOptions) => Promise<Result<SystemInfo>>;
    getPlatform: () => string;
  };
  counter: {
    get: (_payload?: void, options?: IpcCallOptions) => Promise<Result<CounterResult>>;
    increment: (input?: StepInput, options?: IpcCallOptions) => Promise<Result<CounterResult>>;
    decrement: (input?: StepInput, options?: IpcCallOptions) => Promise<Result<CounterResult>>;
    reset: (_payload?: void, options?: IpcCallOptions) => Promise<Result<CounterResult>>;
  };
  calculator: {
    calculate: (
      input: CalculateInput,
      options?: IpcCallOptions,
    ) => Promise<Result<CalculateResult>>;
  };
  window: {
    onCloseRequested: (cb: () => void) => () => void;
    closeReady: (
      _payload?: void,
      options?: IpcCallOptions,
    ) => Promise<Result<{ success: boolean }>>;
    closeRespond: (
      choice: CloseBehaviorChoice,
      options?: IpcCallOptions,
    ) => Promise<Result<{ success: boolean }>>;
  };
  config: {
    get: (_payload?: void, options?: IpcCallOptions) => Promise<Result<AppConfig>>;
    update: (input: UpdateConfigInput, options?: IpcCallOptions) => Promise<Result<AppConfig>>;
    reset: (_payload?: void, options?: IpcCallOptions) => Promise<Result<AppConfig>>;
    onChanged?: (cb: (config: AppConfig) => void) => () => void;
  };
  diagnostics: {
    log: (input: LogInput, options?: IpcCallOptions) => Promise<Result<{ success: boolean }>>;
    openLogFolder: (
      _payload?: void,
      options?: IpcCallOptions,
    ) => Promise<Result<OpenLogFolderResult>>;
    performAction: (
      input: PerformActionInput,
      options?: IpcCallOptions,
    ) => Promise<Result<ActionResult>>;
  };
  dialog: {
    openFile: (
      input?: OpenFileInput,
      options?: IpcCallOptions,
    ) => Promise<Result<FileDialogResult>>;
    openDirectory: (
      input?: OpenDirectoryInput,
      options?: IpcCallOptions,
    ) => Promise<Result<FileDialogResult>>;
    saveFile: (
      input?: SaveFileInput,
      options?: IpcCallOptions,
    ) => Promise<Result<SaveFileDialogResult>>;
  };
  shell: {
    showItemInFolder: (
      input: ShowItemInFolderInput,
      options?: IpcCallOptions,
    ) => Promise<Result<{ success: boolean }>>;
    openExternal: (url: string, options?: IpcCallOptions) => Promise<Result<{ success: boolean }>>;
  };
  updater: {
    getState: (_payload?: void, options?: IpcCallOptions) => Promise<Result<UpdaterSnapshot>>;
    check: (_payload?: void, options?: IpcCallOptions) => Promise<Result<UpdaterSnapshot>>;
    download: (_payload?: void, options?: IpcCallOptions) => Promise<Result<UpdaterSnapshot>>;
    cancel: (_payload?: void, options?: IpcCallOptions) => Promise<Result<UpdaterSnapshot>>;
    install: (_payload?: void, options?: IpcCallOptions) => Promise<Result<{ success: boolean }>>;
    openWindow: (
      _payload?: void,
      options?: IpcCallOptions,
    ) => Promise<Result<{ success: boolean }>>;
    closeWindow: (
      _payload?: void,
      options?: IpcCallOptions,
    ) => Promise<Result<{ success: boolean }>>;
    /** 返回取消订阅函数，渲染层必须在 useEffect cleanup 中调用 */
    onStateChanged: (cb: (s: UpdaterSnapshot) => void) => () => void;
    onProgressChanged: (cb: (p: UpdaterProgress) => void) => () => void;
  };
  // 遵循 specs-electron-fullstack / renderer/ipc-consumption.md 安全规范
  getPathForFile: (file: File) => string;
  invokeTraced?: <R = unknown, T = unknown>(
    channel: string,
    data?: T,
    options?: IpcCallOptions,
  ) => Promise<R>;
}
