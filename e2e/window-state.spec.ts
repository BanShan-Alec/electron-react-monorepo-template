import { expect, test } from './helpers/fixture';

test.describe('主窗口初始几何尺寸与工作区视觉居中 E2E 验证', () => {
  test('冷启动初始尺寸不溢出工作区且上下留白对称居中', async ({ electronApp, page }) => {
    // 等待首屏就绪
    await expect(page.locator('body')).toHaveClass(/app-startup-ready/, { timeout: 5000 });

    const metrics = await electronApp.evaluate(({ BrowserWindow, screen }) => {
      const homeWindow =
        BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.isVisible()) ??
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

    // 2. 高度不超过 85% 工作区上限（或默认 700px）
    const maxAllowedHeight = Math.min(700, Math.floor(workArea.height * 0.85));
    // 即使在超大屏上也不超过 700px；在小屏幕上不超过 85%
    if (workArea.height * 0.85 < 700) {
      expect(bounds.height).toBeLessThanOrEqual(maxAllowedHeight + 2);
    } else {
      expect(bounds.height).toBe(700);
    }

    // 3. 垂直视觉居中：上下留白基本绝对对称（容差 <= 3px）
    const topMargin = bounds.y - workArea.y;
    const bottomMargin = workArea.y + workArea.height - (bounds.y + bounds.height);
    expect(Math.abs(topMargin - bottomMargin)).toBeLessThanOrEqual(3);
  });
});
