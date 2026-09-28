import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from './helpers/fixture';

test.describe('应用偏好设置模块 (Settings Features) E2E 自动化测试', () => {
  test('用例 1：外观主题切换与根节点类名生效', async ({ page }) => {
    // 默认应为跟随系统或浅色/暗色已解析
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', /.+/);

    // 1. 切换至深色模式 (Dark)
    const themeSelect = page.locator('#theme-select');
    await themeSelect.click();
    const darkOption = page.locator('.ant-select-item-option-content', { hasText: '深色模式' });
    await darkOption.click();

    // 断言 data-theme 为 dark，且 classList 包含 dark (以支持 Tailwind darkMode: 'class')
    await expect(html).toHaveAttribute('data-theme', 'dark');
    const isDarkClassPresent = await html.evaluate((el) => el.classList.contains('dark'));
    expect(isDarkClassPresent).toBe(true);

    // 2. 切换至浅色模式 (Light)
    await themeSelect.click();
    const lightOption = page.locator('.ant-select-item-option-content', { hasText: '浅色模式' });
    await lightOption.click();

    // 断言 data-theme 为 light，且 classList 不包含 dark
    await expect(html).toHaveAttribute('data-theme', 'light');
    const isLightClassPresent = await html.evaluate((el) => el.classList.contains('dark'));
    expect(isLightClassPresent).toBe(false);
  });

  test('用例 2：全链路多语言切换（Header + Settings + Counter + 系统托盘）', async ({
    page,
    electronApp,
  }) => {
    const html = page.locator('html');

    // 1. 初始状态断言（简体中文）
    await expect(html).toHaveAttribute('lang', 'zh-CN');
    await expect(page.getByRole('tab', { name: '总览看板' })).toBeVisible();
    await expect(page.getByText('应用偏好设置 (ConfigStore)')).toBeVisible();
    await expect(page.getByText('IPC 计数器 (Counter)')).toBeVisible();

    // 检查托盘右键菜单文案（中文）
    const initialTrayLabel = await electronApp.evaluate(() => {
      const { createRequire } = process.getBuiltinModule('node:module');
      const nodePath = process.getBuiltinModule('node:path');
      const mainIndexPath = nodePath.resolve(process.cwd(), 'packages/main/dist/index.cjs');
      const req = createRequire(mainIndexPath);
      const { getTrayManager } = req(mainIndexPath);
      const tray = getTrayManager?.()?.getContextMenu?.();
      return tray?.items?.[0]?.label;
    });
    expect(initialTrayLabel).toBe('显示主窗口');

    // 2. 切换至 English (en-US)
    const langSelect = page.locator('#lang-select');
    await langSelect.click();
    const enOption = page.locator('.ant-select-item-option-content', { hasText: 'English' });
    await enOption.click();

    // 断言 html lang 属性更新
    await expect(html).toHaveAttribute('lang', 'en-US');

    // 断言 Header 导航标签变为英文
    await expect(page.getByRole('tab', { name: 'Dashboard' })).toBeVisible();

    // 断言 Settings 卡片标题与设置项标签变为英文
    await expect(page.getByText('Preferences (ConfigStore)')).toBeVisible();
    await expect(page.getByText('Appearance Theme')).toBeVisible();

    // 断言跨域典型业务卡片 (Counter) 变为英文
    await expect(page.getByText('IPC Counter')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Increment' })).toBeVisible();

    // 断言主进程系统托盘菜单动态更新为英文
    const updatedTrayLabel = await electronApp.evaluate(() => {
      const { createRequire } = process.getBuiltinModule('node:module');
      const nodePath = process.getBuiltinModule('node:path');
      const mainIndexPath = nodePath.resolve(process.cwd(), 'packages/main/dist/index.cjs');
      const req = createRequire(mainIndexPath);
      const { getTrayManager } = req(mainIndexPath);
      const tray = getTrayManager?.()?.getContextMenu?.();
      return tray?.items?.[0]?.label;
    });
    expect(updatedTrayLabel).toBe('Show Main Window');

    // 3. 切回简体中文 (zh-CN)
    await langSelect.click();
    const zhOption = page.locator('.ant-select-item-option-content', { hasText: '简体中文' });
    await zhOption.click();

    await expect(html).toHaveAttribute('lang', 'zh-CN');
    await expect(page.getByRole('tab', { name: '总览看板' })).toBeVisible();
    await expect(page.getByText('应用偏好设置 (ConfigStore)')).toBeVisible();
    await expect(page.getByText('IPC 计数器 (Counter)')).toBeVisible();
  });

  test('用例 3：点击关闭时最小化到托盘交互与关闭拦截', async ({ page, electronApp }) => {
    // 1. 验证整行/文本可点击性：点击“点击关闭时最小化到托盘”文案或整行可触发开关
    const toggleRow = page.locator('.settings-toggle-row', {
      hasText: '点击关闭时最小化到托盘',
    });
    const checkbox = toggleRow.locator('input[type="checkbox"]');

    // 默认应当为勾选状态
    await expect(checkbox).toBeChecked();

    // 点击文案切换为未勾选
    await toggleRow.locator('text=点击关闭时最小化到托盘').click();
    await expect(checkbox).not.toBeChecked();

    // 再次点击切回勾选
    await toggleRow.locator('text=点击关闭时最小化到托盘').click();
    await expect(checkbox).toBeChecked();

    // 2. 行为验证：当 minimizeToTray 为 true 时，关闭主窗口触发拦截隐藏而非销毁
    const isWindowVisibleBefore = await electronApp.evaluate(() => {
      const { BrowserWindow } = process.getBuiltinModule('electron');
      const win = BrowserWindow.getAllWindows().find((w: any) => !w.isDestroyed());
      return win?.isVisible();
    });
    expect(isWindowVisibleBefore).toBe(true);

    // 触发窗口 close
    await electronApp.evaluate(() => {
      const { BrowserWindow } = process.getBuiltinModule('electron');
      const win = BrowserWindow.getAllWindows().find((w: any) => !w.isDestroyed());
      win?.close();
    });

    // 窗口应被 hide，未被 destroy，依然存活
    const isWindowHidden = await electronApp.evaluate(() => {
      const { BrowserWindow } = process.getBuiltinModule('electron');
      const win = BrowserWindow.getAllWindows().find((w: any) => !w.isDestroyed());
      return win ? !win.isVisible() : false;
    });
    expect(isWindowHidden).toBe(true);

    // 恢复显示主窗口
    await electronApp.evaluate(() => {
      const { BrowserWindow } = process.getBuiltinModule('electron');
      const win = BrowserWindow.getAllWindows().find((w: any) => !w.isDestroyed());
      win?.show();
    });
    await expect(page.locator('body')).toBeVisible();
  });

  test('★ 核心用例 4：连续修改多个 Feature 互不干扰（防冲刷与防重置）', async ({
    page,
    electronCtx,
  }) => {
    // 步骤 1: 修改 theme 为 dark
    const themeSelect = page.locator('#theme-select');
    await themeSelect.click();
    await page.locator('.ant-select-item-option-content', { hasText: '深色模式' }).click();

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // 步骤 2: 修改 language 为 en-US
    const langSelect = page.locator('#lang-select');
    await langSelect.click();
    await page.locator('.ant-select-item-option-content', { hasText: 'English' }).click();

    // 断言语言变更为 en-US
    await expect(html).toHaveAttribute('lang', 'en-US');

    // 【致命校验】：修改语言后，主题必须依然保持为 dark，绝不能被重置回默认的 system 或 light！
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // 步骤 3: 修改 minimizeToTray 为 false
    const toggleRow = page.locator('.settings-toggle-row', {
      hasText: 'Minimize to tray on close',
    });
    const checkbox = toggleRow.locator('input[type="checkbox"]');
    await toggleRow.click();
    await expect(checkbox).not.toBeChecked();

    // 【致命校验】：修改托盘开关后，theme 必须依然是 dark，language 必须依然是 en-US！
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(html).toHaveAttribute('lang', 'en-US');

    // 验证磁盘落盘的 app-config.json 文件确实保留了所有修改项
    const configPath = path.join(electronCtx.tempUserDataDir, 'app-config.json');
    expect(fs.existsSync(configPath)).toBe(true);
    const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    expect(savedConfig.theme).toBe('dark');
    expect(savedConfig.language).toBe('en-US');
    expect(savedConfig.minimizeToTray).toBe(false);
  });
});
