---
title: 端到端断言策略（Shell-stub + Tolerance）
description: "启动阶段整体替换 `shell` 模块，断言只锁协议与最终态，数值断言带容差。"
---

# 端到端断言策略（Shell-stub + Tolerance）

> **TL;DR**：启动阶段整体替换 `shell` 模块，断言只锁协议与最终态，数值断言带容差。

## 要解决的坑

- `shell.openExternal` 这类接口在无头 CI 里会穿透到操作系统，唤起的外部进程持有 stdio 管道，Playwright Worker 收不了尾

## 本仓库的解法

### E2E 只锁协议与最终态：shell 打桩 + 容差断言

E2E 用例严禁穿透操作系统原生界面，`shell` 模块在启动阶段整体替换成桩：

→ 源码：[e2e/helpers/electron.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/e2e/helpers/electron.ts)

```ts
// 【为什么必须全局 Mock 掉 shell 模块？】
// - 在 Linux Xvfb / GitHub Actions 等无头 CI 环境中，缺少标准桌面文件管理器（如 Nautilus），
//   Electron 的 shell.showItemInFolder / openPath 会降级触发 xdg-open，导致系统在后台误唤起
//   Firefox 或其他默认浏览器作为独立后台孤儿进程常驻。
// - 这些外部孤儿进程会持有主进程的 stdout/stderr 管道写端，导致测试套件全部通过后，
//   Playwright Worker 因 stdio 管道无法到达 EOF 而发生严重挂死，触发 45000ms Worker teardown 超时。
await electronApp.evaluate(({ shell }) => {
  shell.openExternal = async (url) => {
    console.warn('[E2E Shell Stub] openExternal called with:', url);
  };
  shell.openPath = async (path) => {
    console.warn('[E2E Shell Stub] openPath called with:', path);
    return '';
  };
  shell.showItemInFolder = (fullPath) => {
    console.warn('[E2E Shell Stub] showItemInFolder called with:', fullPath);
  };
});
```

用例只需验证 IPC 通信协议与参数分发正确性，断言只锁「最终态 + 兜底上界」，精确时序归人工目测：

→ 源码：[e2e/first-screen.spec.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/e2e/first-screen.spec.ts)

```ts
// 时序断言只锁"最终态 + 兜底上界"（spec D7）：
// 0.72s 动画 / 160ms 交叉淡入 / 500ms 退场的精确节奏归人工目测清单
test('AC-1 双门禁达成：body 挂上 app-startup-ready（3000ms 兜底界内）', async ({ page }) => {
  await expect(page.locator('body')).toHaveClass(/app-startup-ready/, {
    timeout: STARTUP_REACT_FALLBACK_MS,
  });
});
```

涉及原生窗口几何的数值断言一律带容差：

→ 源码：[e2e/window-state.spec.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/e2e/window-state.spec.ts)

```ts
// 容差 2px：跨进程恢复时 Windows 会对无边框窗口做一次舍入
for (const key of ['x', 'y', 'width', 'height'] as const) {
  expect(Math.abs(restored[key] - expected[key])).toBeLessThanOrEqual(2);
}
```

落盘类行为则直接读文件断言：`e2e/telemetry.spec.ts` 在真实 IPC 调用后检查 `main.log`、`renderer-home.log`、`traces.ndjson` 存在且内容因果一致，还专门发送超长探针行验证主进程的静默截断。

## 怎么抄

注意点：

- E2E 断言只锁「协议 + 最终态」：`shell` 等系统接口已打桩，穿透原生界面的断言（弹真实对话框、开资源管理器）在这个矩阵里写不了也不该写
- 数值断言带容差：窗口几何对工作区 10px、跨进程恢复 2px——无头 CI 与本地机器的像素级差异不该让用例翻红
