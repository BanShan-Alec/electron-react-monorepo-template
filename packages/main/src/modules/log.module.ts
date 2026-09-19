import fs from 'node:fs';
import path from 'node:path';
import { shell } from 'electron';
import log from 'electron-log/main';
import type { AppModule } from '../AppModule';
import type { ModuleContext } from '../ModuleContext';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export class LogManager implements AppModule {
  public readonly mainLogger = log;
  public readonly rendererLogger = log.create({ logId: 'renderer' });

  constructor() {
    this.#setupLoggers();
  }

  #setupLoggers(): void {
    // 5MB 轮转上限
    const MAX_SIZE = 5 * 1024 * 1024;

    // 主进程日志配置
    this.mainLogger.transports.file.fileName = 'main.log';
    this.mainLogger.transports.file.maxSize = MAX_SIZE;

    // 渲染进程日志配置
    this.rendererLogger.transports.file.fileName = 'renderer.log';
    this.rendererLogger.transports.file.maxSize = MAX_SIZE;

    // 格式化输出
    const format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    this.mainLogger.transports.file.format = format;
    this.rendererLogger.transports.file.format = format;

    // 捕获未捕获异常并落盘
    this.mainLogger.errorHandler.startCatching({
      showDialog: false,
      onError: ({ error }) => {
        this.mainLogger.error('[Uncaught Exception]', error);
      },
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
    try {
      const logsDir = this.getLogDirectory();
      if (!fs.existsSync(logsDir)) return;

      const files = fs.readdirSync(logsDir);
      const now = Date.now();
      const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;

      const archivedFiles: { name: string; fullPath: string; mtime: number }[] = [];

      for (const file of files) {
        if (!file.includes('.old')) continue;

        const fullPath = path.join(logsDir, file);
        try {
          const stats = fs.statSync(fullPath);
          // 超过指定天数直接删除
          if (now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(fullPath);
          } else {
            archivedFiles.push({ name: file, fullPath, mtime: stats.mtimeMs });
          }
        } catch {
          // 忽略单个文件访问错误
        }
      }

      // 如果超出归档数量上限，按时间升序淘汰最老的文件
      if (archivedFiles.length > maxFiles) {
        archivedFiles.sort((a, b) => a.mtime - b.mtime);
        const toDeleteCount = archivedFiles.length - maxFiles;
        for (let i = 0; i < toDeleteCount; i++) {
          try {
            fs.unlinkSync(archivedFiles[i].fullPath);
          } catch {
            // 忽略
          }
        }
      }
    } catch (err) {
      this.mainLogger.warn('Failed to clean old logs:', err);
    }
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

  public logRendererMessage(level: LogLevel, message: string, meta?: unknown): void {
    const fn = this.rendererLogger[level] || this.rendererLogger.info;
    if (meta !== undefined) {
      fn(`[Renderer] ${message}`, meta);
    } else {
      fn(`[Renderer] ${message}`);
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
