import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type ElectronApplication, _electron as electron, type Page } from '@playwright/test';

export interface LaunchElectronOptions {
  /**
   * 额外的命令行参数
   */
  extraArgs?: string[];
  /**
   * 额外的环境变量
   */
  extraEnv?: Record<string, string>;
}

export interface ElectronTestContext {
  /**
   * Electron 主程序实例
   */
  electronApp: ElectronApplication;
  /**
   * 默认的主窗口 Page 句柄
   */
  page: Page;
  /**
   * 本次运行隔离的用户数据临时目录
   */
  tempUserDataDir: string;
  /**
   * 优雅清理资源函数（关闭进程并清除临时目录）
   */
  cleanup: () => Promise<void>;
}

/**
 * 启动 Electron 自动化测试环境公共上下文
 * 封装了 4 大标准启动步骤：
 * 1. 创建隔离的临时用户数据目录（规避本地单例锁冲突）
 * 2. 注入静音/测试环境参数拉起 Electron 进程
 * 3. 管道化重定向主进程 stdout / stderr 至测试终端
 * 4. 等待首个窗口创建并加载就绪
 */
export async function launchElectronApp(
  options: LaunchElectronOptions = {},
): Promise<ElectronTestContext> {
  // 1. 创建隔离的临时用户数据目录
  const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-e2e-'));

  // 2. 启动 Electron 应用
  const electronApp = await electron.launch({
    args: [
      '.',
      `--user-data-dir=${tempUserDataDir}`,
      '--disable-gpu',
      '--no-sandbox',
      ...(options.extraArgs ?? []),
    ],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ...options.extraEnv,
    },
  });

  // 3. 将主进程日志重定向至控制台以便追踪诊断
  electronApp.process().stdout?.pipe(process.stdout);
  electronApp.process().stderr?.pipe(process.stderr);

  // 4. 等待应用首个窗口加载就绪
  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  const cleanup = async () => {
    if (electronApp) {
      await electronApp.close();
    }

    if (tempUserDataDir && fs.existsSync(tempUserDataDir)) {
      try {
        fs.rmSync(tempUserDataDir, { recursive: true, force: true });
      } catch {
        // 忽略 Windows 系统下的进程临时文件锁
      }
    }
  };

  return {
    electronApp,
    page,
    tempUserDataDir,
    cleanup,
  };
}
