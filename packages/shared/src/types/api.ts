import type { CalculateInput } from '../schemas/calculator';
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
import type { UpdaterProgress, UpdaterSnapshot } from './updater';

/**
 * Window.api 跨端统一契约接口 (ElectronApi)
 */
export interface ElectronApi {
  system: {
    ping: () => Promise<Result<PingResult>>;
    getSystemInfo: () => Promise<Result<SystemInfo>>;
  };
  counter: {
    get: () => Promise<Result<CounterResult>>;
    increment: (input?: StepInput) => Promise<Result<CounterResult>>;
    decrement: (input?: StepInput) => Promise<Result<CounterResult>>;
    reset: () => Promise<Result<CounterResult>>;
  };
  calculator: {
    calculate: (input: CalculateInput) => Promise<Result<CalculateResult>>;
  };
  config: {
    get: () => Promise<Result<AppConfig>>;
    update: (input: UpdateConfigInput) => Promise<Result<AppConfig>>;
    reset: () => Promise<Result<AppConfig>>;
    onChanged?: (cb: (config: AppConfig) => void) => () => void;
  };
  diagnostics: {
    log: (input: LogInput) => Promise<Result<{ success: boolean }>>;
    openLogFolder: () => Promise<Result<OpenLogFolderResult>>;
    performAction: (input: PerformActionInput) => Promise<Result<ActionResult>>;
  };
  dialog: {
    openFile: (input?: OpenFileInput) => Promise<Result<FileDialogResult>>;
    openDirectory: (input?: OpenDirectoryInput) => Promise<Result<FileDialogResult>>;
    saveFile: (input?: SaveFileInput) => Promise<Result<SaveFileDialogResult>>;
  };
  shell: {
    showItemInFolder: (input: ShowItemInFolderInput) => Promise<Result<{ success: boolean }>>;
    openExternal: (url: string) => Promise<Result<{ success: boolean }>>;
  };
  updater: {
    getState: () => Promise<Result<UpdaterSnapshot>>;
    check: () => Promise<Result<UpdaterSnapshot>>;
    download: () => Promise<Result<UpdaterSnapshot>>;
    cancel: () => Promise<Result<UpdaterSnapshot>>;
    install: () => Promise<Result<{ success: boolean }>>;
    openWindow: () => Promise<Result<{ success: boolean }>>;
    closeWindow: () => Promise<Result<{ success: boolean }>>;
    /** 返回取消订阅函数，渲染层必须在 useEffect cleanup 中调用 */
    onStateChanged: (cb: (s: UpdaterSnapshot) => void) => () => void;
    onProgressChanged: (cb: (p: UpdaterProgress) => void) => () => void;
  };
  // 遵循 specs-electron-fullstack / renderer/ipc-consumption.md 安全规范
  getPathForFile: (file: File) => string;
}
