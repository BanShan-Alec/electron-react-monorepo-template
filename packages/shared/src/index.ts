import { z } from 'zod';

/**
 * 全栈统一 IPC 响应结果契约对象
 * 对齐 specs-electron-fullstack / core/error-codes.md
 */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * 语义化错误码统一推行常量 (SCREAMING_SNAKE_CASE)
 * 严禁使用 HTTP 404/500 或纯数字错误码
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DIVIDE_BY_ZERO: 'DIVIDE_BY_ZERO',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  WINDOW_NOT_FOUND: 'WINDOW_NOT_FOUND',
  INVALID_PROTOCOL: 'INVALID_PROTOCOL',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/* =========================================================================
 * 1. 系统与运行环境契约 (System Domain)
 * ========================================================================= */
export interface PingResult {
  message: string;
  timestamp: number; // Unix 毫秒统一规范
  serverTime: string;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
  chromeVersion: string;
  v8Version: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryMB: number;
  freeMemoryMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
  uptimeSeconds: number;
}

/* =========================================================================
 * 2. 计数器契约 (Counter Domain)
 * ========================================================================= */
export const stepInputSchema = z.object({
  step: z.number().int().min(1).max(100).default(1),
});

export type StepInput = z.infer<typeof stepInputSchema>;

export interface CounterResult {
  count: number;
  step?: number;
}

/* =========================================================================
 * 3. 四则运算计算器契约 (Calculator Domain)
 * ========================================================================= */
export const calculateInputSchema = z.object({
  a: z.number(),
  b: z.number(),
  op: z.enum(['add', 'subtract', 'multiply', 'divide']),
});

export type CalculateInput = z.infer<typeof calculateInputSchema>;

export interface CalculateResult {
  a: number;
  b: number;
  op: 'add' | 'subtract' | 'multiply' | 'divide';
  result: number;
}

/* =========================================================================
 * 4. 配置中心契约 (Config Domain)
 * ========================================================================= */
export const configSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  minimizeToTray: z.boolean().default(true),
  language: z.string().default('zh-CN'),
  autoCheckUpdate: z.boolean().default(true),
  serverCounter: z.number().int().default(0),
});

export type AppConfig = z.infer<typeof configSchema>;

export const updateConfigInputSchema = configSchema.partial();
export type UpdateConfigInput = z.infer<typeof updateConfigInputSchema>;

export const DEFAULT_CONFIG: AppConfig = {
  theme: 'system',
  minimizeToTray: true,
  language: 'zh-CN',
  autoCheckUpdate: true,
  serverCounter: 0,
};

/* =========================================================================
 * 5. 诊断日志与系统行为契约 (Diagnostics Domain)
 * ========================================================================= */
export const logInputSchema = z.object({
  level: z.enum(['info', 'warn', 'error', 'debug']).default('info'),
  message: z.string(),
  meta: z.unknown().optional(),
});

export type LogInput = z.infer<typeof logInputSchema>;

export const performActionInputSchema = z.object({
  action: z.enum(['toggleDevTools', 'openUrl']),
  url: z.string().url().optional(),
});

export type PerformActionInput = z.infer<typeof performActionInputSchema>;

export interface ActionResult {
  success: boolean;
  message: string;
}

export interface OpenLogFolderResult {
  success: boolean;
  path: string;
}

/* =========================================================================
 * 6. 原生对话框与 Shell 契约 (Dialog & Shell Domain)
 * ========================================================================= */
export const openFileInputSchema = z
  .object({
    title: z.string().optional(),
    filters: z
      .array(
        z.object({
          name: z.string(),
          extensions: z.array(z.string()),
        }),
      )
      .optional(),
    multiSelections: z.boolean().optional(),
  })
  .optional();

export type OpenFileInput = z.infer<typeof openFileInputSchema>;

export const openDirectoryInputSchema = z
  .object({
    title: z.string().optional(),
  })
  .optional();

export type OpenDirectoryInput = z.infer<typeof openDirectoryInputSchema>;

export const saveFileInputSchema = z
  .object({
    title: z.string().optional(),
    defaultPath: z.string().optional(),
    filters: z
      .array(
        z.object({
          name: z.string(),
          extensions: z.array(z.string()),
        }),
      )
      .optional(),
  })
  .optional();

export type SaveFileInput = z.infer<typeof saveFileInputSchema>;

export interface FileDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface SaveFileDialogResult {
  canceled: boolean;
  filePath?: string;
}

export const showItemInFolderInputSchema = z.object({
  path: z.string().min(1, '路径不能为空'),
});

export type ShowItemInFolderInput = z.infer<typeof showItemInFolderInputSchema>;

/* =========================================================================
 * 7. IPC 通信通道常量定义 (IPC Channels)
 * ========================================================================= */
export const IPC_CHANNELS = {
  SYSTEM_PING: 'system:ping',
  SYSTEM_GET_INFO: 'system:get-info',

  COUNTER_GET: 'counter:get',
  COUNTER_INCREMENT: 'counter:increment',
  COUNTER_DECREMENT: 'counter:decrement',
  COUNTER_RESET: 'counter:reset',

  CALCULATOR_CALCULATE: 'calculator:calculate',

  CONFIG_GET: 'config:get',
  CONFIG_UPDATE: 'config:update',
  CONFIG_RESET: 'config:reset',

  DIAGNOSTICS_LOG: 'diagnostics:log',
  DIAGNOSTICS_OPEN_LOG_FOLDER: 'diagnostics:open-log-folder',
  DIAGNOSTICS_PERFORM_ACTION: 'diagnostics:perform-action',

  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_OPEN_DIRECTORY: 'dialog:open-directory',
  DIALOG_SAVE_FILE: 'dialog:save-file',
  SHELL_SHOW_ITEM_IN_FOLDER: 'shell:show-item-in-folder',
} as const;

/* =========================================================================
 * 8. Window.api 跨端统一契约接口 (ElectronApi)
 * ========================================================================= */
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
