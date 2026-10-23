import {
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  MAX_WORK_AREA_RATIO,
  MAX_WORK_AREA_WIDTH_RATIO,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
} from '../packages/shared/src/constants/window-geometry';
import { expect, test } from './helpers/fixture';

test.describe('主窗口初始几何尺寸与工作区视觉居中 E2E 验证', () => {
  test('冷启动初始尺寸不溢出工作区且上下留白对称居中', async ({ electronApp, page }) => {
    // 等待首屏就绪
    await expect(page.locator('body')).toHaveClass(/app-startup-ready/, { timeout: 5000 });

    const metrics = await electronApp.evaluate(({ BrowserWindow, screen }) => {
      // 必须精确匹配 Home 主窗口，防止并发或前序测试残留的 Updater 窗口 (480x460) 造成干扰
      const homeWindow =
        BrowserWindow.getAllWindows().find(
          (w) => !w.isDestroyed() && w.isVisible() && !w.webContents.getURL().includes('updater'),
        ) ??
        BrowserWindow.getAllWindows().find(
          (w) => !w.isDestroyed() && !w.webContents.getURL().includes('updater'),
        ) ??
        BrowserWindow.getAllWindows()[0];

      const primaryDisplay = screen.getPrimaryDisplay();
      return {
        bounds: homeWindow.getBounds(),
        workArea: primaryDisplay.workArea,
      };
    });

    expect(metrics).toBeDefined();
    const { bounds, workArea } = metrics;

    // 1. 尺寸在当前显示器工作区以内，绝不溢出任务栏
    expect(bounds.width).toBeLessThanOrEqual(workArea.width);
    expect(bounds.height).toBeLessThanOrEqual(workArea.height);

    // 2. 宽高精确符合自适应算法：小屏受限时收缩，大屏满足标准尺寸
    const expectedWidth = Math.max(
      MIN_WINDOW_WIDTH,
      Math.min(DEFAULT_WINDOW_WIDTH, Math.floor(workArea.width * MAX_WORK_AREA_WIDTH_RATIO)),
    );
    const expectedHeight = Math.max(
      MIN_WINDOW_HEIGHT,
      Math.min(DEFAULT_WINDOW_HEIGHT, Math.floor(workArea.height * MAX_WORK_AREA_RATIO)),
    );

    expect(Math.abs(bounds.width - expectedWidth)).toBeLessThanOrEqual(2);
    expect(Math.abs(bounds.height - expectedHeight)).toBeLessThanOrEqual(2);

    // 3. 垂直视觉居中：上下留白基本绝对对称（容差 <= 3px）
    const topMargin = bounds.y - workArea.y;
    const bottomMargin = workArea.y + workArea.height - (bounds.y + bounds.height);
    expect(Math.abs(topMargin - bottomMargin)).toBeLessThanOrEqual(3);
  });
});
