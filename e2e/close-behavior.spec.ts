import fs from 'node:fs';
import path from 'node:path';
import { launchElectronApp } from './helpers/electron';
import { expect, test } from './helpers/fixture';

declare global {
  interface Window {
    api: {
      config: {
        update: (input: { language: 'zh-CN' }) => Promise<unknown>;
      };
    };
  }
}

async function closeHomeWindow(
  electronApp: Awaited<ReturnType<typeof launchElectronApp>>['electronApp'],
) {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const homeWindow = BrowserWindow.getAllWindows().find(
      (window) => !window.isDestroyed() && !window.webContents.getURL().includes('updater'),
    );
    homeWindow?.close();
  });
}

async function setChineseLanguage(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    await window.api.config.update({ language: 'zh-CN' });
  });
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
}

async function homeWindowExists(
  electronApp: Awaited<ReturnType<typeof launchElectronApp>>['electronApp'],
) {
  return electronApp.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().some(
      (window) => !window.isDestroyed() && !window.webContents.getURL().includes('updater'),
    ),
  );
}

test.describe('首次关闭确认', () => {
  test('选择关闭窗口后销毁主窗口并保留托盘进程', async () => {
    const ctx = await launchElectronApp();
    try {
      await expect(ctx.page.locator('body')).toHaveClass(/app-startup-ready/, {
        timeout: 10_000,
      });
      await setChineseLanguage(ctx.page);
      await closeHomeWindow(ctx.electronApp);
      await expect(ctx.page.getByRole('dialog')).toBeVisible();
      await ctx.page.getByRole('button', { name: '关闭窗口', exact: true }).click();

      await expect.poll(() => homeWindowExists(ctx.electronApp), { timeout: 5_000 }).toBe(false);
      const savedConfig = JSON.parse(
        fs.readFileSync(path.join(ctx.tempUserDataDir, 'config.json'), 'utf-8'),
      );
      expect(savedConfig.minimizeToTray).toBe(true);
      expect(savedConfig.closeBehaviorConfirmed).toBe(true);

      expect(await ctx.electronApp.evaluate(({ app }) => app.isReady())).toBe(true);
    } finally {
      await ctx.cleanup();
    }
  });

  test('取消不保存选择，下一次关闭再次询问', async () => {
    const ctx = await launchElectronApp();
    try {
      await expect(ctx.page.locator('body')).toHaveClass(/app-startup-ready/, {
        timeout: 10_000,
      });
      await setChineseLanguage(ctx.page);
      await closeHomeWindow(ctx.electronApp);
      await expect(ctx.page.getByRole('dialog')).toBeVisible();
      await ctx.page.getByRole('button', { name: '取消', exact: true }).click();
      await expect(ctx.page.getByRole('dialog')).toBeHidden();
      expect(await homeWindowExists(ctx.electronApp)).toBe(true);

      const configPath = path.join(ctx.tempUserDataDir, 'config.json');
      const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(savedConfig.closeBehaviorConfirmed).toBe(false);

      await closeHomeWindow(ctx.electronApp);
      await expect(ctx.page.getByRole('dialog')).toBeVisible();
    } finally {
      await ctx.cleanup();
    }
  });

  test('弹窗无人响应时十秒后按既有配置放行', async () => {
    test.setTimeout(20_000);
    const ctx = await launchElectronApp();
    try {
      await expect(ctx.page.locator('body')).toHaveClass(/app-startup-ready/, {
        timeout: 10_000,
      });
      await setChineseLanguage(ctx.page);
      await closeHomeWindow(ctx.electronApp);
      await expect(ctx.page.getByRole('dialog')).toBeVisible();

      await expect.poll(() => homeWindowExists(ctx.electronApp), { timeout: 15_000 }).toBe(false);
      const savedConfig = JSON.parse(
        fs.readFileSync(path.join(ctx.tempUserDataDir, 'config.json'), 'utf-8'),
      );
      expect(savedConfig.minimizeToTray).toBe(true);
      expect(savedConfig.closeBehaviorConfirmed).toBe(false);
    } finally {
      await ctx.cleanup();
    }
  });
});
