---
title: 主进程单元测试（EventEmitter）
description: "用 EventEmitter 顶替 `app`、在模块边界换桩，不启动 Electron 也能验证生命周期。"
---

# 主进程单元测试（EventEmitter）

> **TL;DR**：用 EventEmitter 顶替 `app`、在模块边界换桩，不启动 Electron 也能验证生命周期。

## 要解决的坑

- 主进程模块大量依赖 `electron` 运行时（`app`、`BrowserWindow`、`Tray`），直接 import 就没法在纯 Node 环境跑，单测无从下手

## 本仓库的解法

### 主进程单测不启动 Electron：EventEmitter 顶替 + 模块边界打桩

→ 源码：[packages/main/tests/unit/tray-lifecycle.test.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/tests/unit/tray-lifecycle.test.ts)

```ts
it('does not quit when minimizeToTray is true and not quitting', () => {
  const mockApp = new EventEmitter() as unknown as Electron.App;
  (mockApp as unknown as { quit: () => void }).quit = vi.fn();

  vi.spyOn(configModule, 'getAppConfigStore').mockReturnValue({
    get: (key: string) => key === 'minimizeToTray',
  } as unknown as ReturnType<typeof configModule.getAppConfigStore>);

  const terminator = new ApplicationTerminatorOnLastWindowClose();
  terminator.enable({
    app: mockApp,
  } as unknown as import('@app/main/ModuleContext').ModuleContext);

  mockApp.emit('window-all-closed');

  expect((mockApp as unknown as { quit: () => void }).quit).not.toHaveBeenCalled();
});
```

在这个模块眼里 `app` 就是个事件发射器：`new EventEmitter()` 强转类型即可，`quit` 换成 `vi.fn()`，配置读取用 `vi.spyOn` 在模块边界换桩。测试主动 `emit('window-all-closed')` 再断言 `quit` 的调用与否——不启动 Electron、不建任何窗口。真窗口、真进程的行为留给 E2E 层。
