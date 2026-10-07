import fs from 'node:fs';
import path from 'node:path';
import { app, dialog } from 'electron';

type FatalCrashType = 'uncaughtException' | 'unhandledRejection';

/**
 * 致命错误同步落盘与系统原生弹窗告警 (跨全生命周期，包括生产打包态)
 *
 * 本文件必须保持为 index.ts 的第一个 import：import 期异常发生在 index.ts
 * 函数体执行之前，只有在这里（模块求值阶段）安装的监听器才能接住它们。
 * 本文件不导出任何东西，只能以副作用方式引入。
 */
function handleFatalCrash(type: FatalCrashType, error: unknown): void {
  const errorDetails = error instanceof Error ? error.stack || error.message : String(error);
  const logContent = `\n[FATAL CRASH] [${new Date().toISOString()}] [${type}]\n${errorDetails}\n`;

  console.error(logContent);

  try {
    const logDir = path.join(app?.getPath?.('userData') || process.cwd(), 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'fatal-crash.log'), logContent, 'utf8');
  } catch {
    try {
      fs.appendFileSync(path.join(process.cwd(), 'fatal-crash.log'), logContent, 'utf8');
    } catch {}
  }

  dialog.showErrorBox(
    'Application Initialization Error',
    `A critical error occurred while starting the application:\n\n${errorDetails}\n\nPlease check fatal-crash.log for details.`,
  );

  process.exit(1);
}

// 引入即安装：先于 index.ts 的其他模块求值，兜住任何模块 import 期的同步异常
process.on('uncaughtException', (err) => handleFatalCrash('uncaughtException', err));
process.on('unhandledRejection', (reason) => handleFatalCrash('unhandledRejection', reason));
