import fs from 'node:fs';
import path from 'node:path';
import type { SpanRecord } from '@app/shared/types/telemetry';
import { shell } from 'electron';
import type { LogMessage } from 'electron-log';
import log from 'electron-log/main';
import type { AppModule } from '../AppModule';
import type { ModuleContext } from '../ModuleContext';
import { getTracer } from '../telemetry/tracer';
import { cleanArchivedLogs, createCustomArchiveLogFn } from './log-archiver';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface IScopedLogger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

export class LogManager implements AppModule {
  public readonly mainLogger = log;
  public readonly traceLogger = log.create({ logId: 'traces' });
  private readonly windowLoggers = new Map<string, ReturnType<typeof log.create>>();

  private readonly injectTraceHook = (message: LogMessage): LogMessage => {
    const ctx = getTracer().getActiveContext();
    if (ctx && message.data && message.data.length > 0) {
      const traceTag = `[trace_id:${ctx.traceId} span_id:${ctx.spanId}]`;
      if (typeof message.data[0] === 'string') {
        if (!message.data[0].includes('[trace_id:')) {
          message.data[0] = `${traceTag} ${message.data[0]}`;
        }
      } else {
        message.data.unshift(traceTag);
      }
    }
    return message;
  };

  constructor() {
    this.setupLoggers();
  }

  public getWindowLogger(windowName = 'home'): ReturnType<typeof log.create> {
    let winLogger = this.windowLoggers.get(windowName);
    if (!winLogger) {
      winLogger = log.create({ logId: `renderer-${windowName}` });
      winLogger.transports.file.fileName = `renderer-${windowName}.log`;
      winLogger.transports.file.maxSize = 5 * 1024 * 1024;
      winLogger.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
      winLogger.transports.file.archiveLogFn = createCustomArchiveLogFn();
      winLogger.hooks.push(this.injectTraceHook);
      this.windowLoggers.set(windowName, winLogger);
    }
    return winLogger;
  }

  public get rendererLogger(): ReturnType<typeof log.create> {
    return this.getWindowLogger('home');
  }

  private setupLoggers(): void {
    // 5MB 轮转上限
    const MAX_SIZE = 5 * 1024 * 1024;
    const TRACE_MAX_SIZE = 10 * 1024 * 1024;

    // 主进程日志配置
    this.mainLogger.transports.file.fileName = 'main.log';
    this.mainLogger.transports.file.maxSize = MAX_SIZE;
    this.mainLogger.transports.file.archiveLogFn = createCustomArchiveLogFn();

    // 遥测拓扑日志配置 (NDJSON 独立文件)
    this.traceLogger.transports.file.fileName = 'traces.ndjson';
    this.traceLogger.transports.file.maxSize = TRACE_MAX_SIZE;
    this.traceLogger.transports.file.format = '{text}';
    this.traceLogger.transports.console.level = false;
    this.traceLogger.transports.file.archiveLogFn = createCustomArchiveLogFn();

    // 格式化输出
    const format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    this.mainLogger.transports.file.format = format;

    // 捕获未捕获异常并落盘
    this.mainLogger.errorHandler.startCatching({
      showDialog: false,
      onError: ({ error }) => {
        this.mainLogger.error('[Uncaught Exception]', error);
      },
    });

    // 注册主进程 Trace 注入 Hook
    this.mainLogger.hooks.push(this.injectTraceHook);

    // 预初始化默认 home 窗口的 logger
    this.getWindowLogger('home');

    // 监听 Span 结束，以 NDJSON 格式落盘至 traces.ndjson
    getTracer().onSpanEnd((record: SpanRecord) => {
      try {
        this.traceLogger.info(JSON.stringify(record));
      } catch (err) {
        this.mainLogger.warn('[LogManager] Failed to write SpanRecord:', err);
      }
    });
  }

  public enable({ app }: ModuleContext): void {
    app.whenReady().then(() => {
      this.cleanOldLogs();
      this.mainLogger.info('[App Lifecycle] Application ready, logging system initialized');
    });
  }

  /**
   * 清理过期（> 7天）或超额（> 5个）的历史归档日志
   */
  public cleanOldLogs(maxDays = 7, maxFiles = 5): void {
    const logsDir = this.getLogDirectory();
    cleanArchivedLogs(logsDir, { maxDays, maxFilesPerCategory: maxFiles });
  }

  /**
   * 自动生成带 [Module] 前缀的作用域子 Logger
   * @param target 字符串（如 'WindowManager'）或直接传对象/实例 `this`（自动提取 Class 名）
   */
  public scoped(target: string | object): IScopedLogger {
    const tag = typeof target === 'string' ? target : target.constructor.name;
    const prefix = `[${tag}]`;

    return {
      info: (message: string, ...args: unknown[]) =>
        this.mainLogger.info(`${prefix} ${message}`, ...args),
      warn: (message: string, ...args: unknown[]) =>
        this.mainLogger.warn(`${prefix} ${message}`, ...args),
      error: (message: string, ...args: unknown[]) =>
        this.mainLogger.error(`${prefix} ${message}`, ...args),
      debug: (message: string, ...args: unknown[]) =>
        this.mainLogger.debug(`${prefix} ${message}`, ...args),
    };
  }

  public getLogDirectory(): string {
    const file = this.mainLogger.transports.file.getFile();
    return path.dirname(file.path);
  }

  public async openLogFolder(): Promise<void> {
    const dir = this.getLogDirectory();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await shell.openPath(dir);
  }

  public logRendererMessage(
    level: LogLevel,
    message: string,
    meta?: unknown,
    windowName?: string,
  ): void {
    const targetName = windowName || 'home';
    const targetLogger = this.getWindowLogger(targetName);
    const fn = targetLogger[level] || targetLogger.info;
    if (meta !== undefined) {
      fn(`[Renderer] [${targetName}] ${message}`, meta);
    } else {
      fn(`[Renderer] [${targetName}] ${message}`);
    }
  }
}

let loggerInstance: LogManager | null = null;

export function getLogManager(): LogManager {
  if (!loggerInstance) {
    loggerInstance = new LogManager();
  }
  return loggerInstance;
}

export function createLogModule(): LogManager {
  return getLogManager();
}
