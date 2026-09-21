import type {
  AppConfig,
  CalculateInput,
  LogInput,
  OpenDirectoryInput,
  OpenFileInput,
  PerformActionInput,
  SaveFileInput,
  ShowItemInFolderInput,
  StepInput,
  UpdateConfigInput,
} from '../schemas';
import type { CalculateResult } from './calculator';
import type { CounterResult } from './counter';
import type { ActionResult, OpenLogFolderResult } from './diagnostics';
import type { FileDialogResult, SaveFileDialogResult } from './dialog';
import type { Result } from './result';
import type { PingResult, SystemInfo } from './system';

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
  };
  // 遵循 specs-electron-fullstack / renderer/ipc-consumption.md 安全规范
  getPathForFile: (file: File) => string;
}
