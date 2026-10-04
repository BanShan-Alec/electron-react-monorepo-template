import { execSync } from 'node:child_process';
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
 * 跨平台强力终止进程及其所有子孙进程
 */
function killProcessTree(pid: number, tempUserDataDir?: string): void {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      // 1. 优先通过唯一 user-data-dir 特征清理属于本实例的所有 Electron 关联进程
      if (tempUserDataDir) {
        try {
          execSync(`pkill -9 -f "${tempUserDataDir}"`, { stdio: 'ignore' });
        } catch {}
      }
      // 2. 杀灭直接子进程
      try {
        execSync(`pkill -9 -P ${pid}`, { stdio: 'ignore' });
      } catch {}
      // 3. 杀灭主进程自身
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
  } catch {
    // 忽略终止异常
  }
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
      '--disable-dev-shm-usage',
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
  const proc = electronApp.process();
  proc.stdout?.pipe(process.stdout);
  proc.stderr?.pipe(process.stderr);

  // 4. 注入主进程 shell 安全桩（防止任何用例拉起外部系统文件管理器或浏览器造成 CI 挂死）
  await electronApp.evaluate(({ shell }) => {
    shell.openExternal = async () => {};
    shell.openPath = async () => '';
    shell.showItemInFolder = () => {};
  });

  // 5. 等待应用首个窗口加载就绪
  const page = await electronApp.firstWindow();
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err));
  await page.waitForLoadState('domcontentloaded');

  const cleanup = async () => {
    if (electronApp) {
      const pid = proc?.pid;

      try {
        // 限时 5 秒等待 Playwright electronApp.close() 完成
        await Promise.race([
          electronApp.close(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('electronApp.close() timed out after 5000ms')), 5000),
          ),
        ]);
      } catch (err) {
        console.warn(
          '[E2E Teardown] electronApp.close() timed out or failed, killing process tree:',
          err,
        );
        if (pid) {
          killProcessTree(pid, tempUserDataDir);
        }
      } finally {
        // 确保断开并销毁 stdio 管道，防止未关闭句柄阻塞 Worker 退出
        if (proc) {
          try {
            if (proc.stdout) {
              proc.stdout.unpipe(process.stdout);
              proc.stdout.destroy();
            }
            if (proc.stderr) {
              proc.stderr.unpipe(process.stderr);
              proc.stderr.destroy();
            }
          } catch {
            // 忽略流销毁异常
          }
        }

        // 兜底检查：如果主进程或子进程依然残留，强制杀灭进程树
        if (pid) {
          try {
            process.kill(pid, 0);
            killProcessTree(pid, tempUserDataDir);
          } catch {
            // 进程已退出
          }
        }
      }
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
