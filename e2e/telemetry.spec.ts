import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from './helpers/fixture';

test.describe('本地遥测系统 (Mini-OTel) E2E 验证与日志捞取', () => {
  test('端到端调用产生 trace 并成功落盘 main.log 和 traces.ndjson', async ({
    page,
    tempUserDataDir,
  }) => {
    // 1. 等待主窗口就绪
    await expect(page.locator('body')).toHaveClass(/app-startup-ready/, { timeout: 3000 });

    // 2. 模拟渲染进程发起带追踪的 IPC 请求（包含计数器、计算器和业务日志诊断调用）
    const res = await page.evaluate(async () => {
      const api = (
        window as unknown as {
          api: {
            counter: { increment: (args: unknown) => Promise<unknown> };
            calculator: {
              calculate: (args: unknown) => Promise<{ success: boolean; data: { result: number } }>;
            };
            diagnostics: { log: (args: unknown) => Promise<unknown> };
          };
        }
      ).api;
      const counterRes = await api.counter.increment({ step: 1 });
      const calcRes = await api.calculator.calculate({ a: 15, b: 27, op: 'add' });
      const diagRes = await api.diagnostics.log({
        level: 'info',
        message: 'Business action executed in traced context',
      });
      return { counterRes, calcRes, diagRes };
    });

    expect(res.calcRes.success).toBe(true);
    expect(res.calcRes.data.result).toBe(42);

    // 3. 稍作等待确保 electron-log 写入文件刷盘
    await page.waitForTimeout(500);

    const logsDir = path.join(tempUserDataDir, 'logs');
    expect(fs.existsSync(logsDir)).toBe(true);

    const mainLogPath = path.join(logsDir, 'main.log');
    const rendererHomeLogPath = path.join(logsDir, 'renderer-home.log');
    const tracesPath = path.join(logsDir, 'traces.ndjson');

    expect(fs.existsSync(mainLogPath)).toBe(true);
    expect(fs.existsSync(rendererHomeLogPath)).toBe(true);
    expect(fs.existsSync(tracesPath)).toBe(true);

    const mainLogContent = fs.readFileSync(mainLogPath, 'utf-8');
    const rendererLogContent = fs.readFileSync(rendererHomeLogPath, 'utf-8');
    const tracesContent = fs.readFileSync(tracesPath, 'utf-8');

    console.log('\n================== [main.log 真实日志样本] ==================');
    console.log(mainLogContent.trim());
    console.log('============================================================\n');

    console.log('\n============== [renderer-home.log 真实日志样本] ==============');
    console.log(rendererLogContent.trim());
    console.log('============================================================\n');

    console.log('\n================= [traces.ndjson 真实日志样本] =================');
    console.log(tracesContent.trim());
    console.log('==============================================================\n');

    // 4. 校验 traces.ndjson 内容与因果关系
    const lines = tracesContent.trim().split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);

    const records = lines.map((l) => JSON.parse(l));
    const spanNames = records.map((r) => r.name);

    expect(spanNames).toContain('window.initialization');
    expect(spanNames).toContain('ipc.receive:counter:increment');
    expect(spanNames).toContain('ipc.receive:calculator:calculate');
    expect(spanNames).toContain('ipc.receive:diagnostics:log');

    // 校验 main.log 中成功注入了 trace_id 与 span_id
    expect(mainLogContent).toMatch(/\[trace_id:[0-9a-f]{32}\s+span_id:[0-9a-f]{16}\]/);

    // 校验 renderer.log 中同样注入了 trace 上下文与窗口 attribution
    expect(rendererLogContent).toMatch(/\[trace_id:[0-9a-f]{32}\s+span_id:[0-9a-f]{16}\]/);
    expect(rendererLogContent).toContain('[Renderer] [home]');

    // 验证每条 SpanRecord 的基础结构
    for (const record of records) {
      expect(record.type).toBe('span');
      expect(record.trace_id).toMatch(/^[0-9a-f]{32}$/);
      expect(record.span_id).toMatch(/^[0-9a-f]{16}$/);
      expect(typeof record.duration_ms).toBe('number');
      expect(record.status).toBe('OK');
    }
  });
});
