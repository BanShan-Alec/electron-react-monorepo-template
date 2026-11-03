---
title: 模块生命周期（ModuleRunner）
description: 采用 ModuleRunner 微内核将系统能力解耦为可插拔模块，链式装配并在入口删一行即可整体退场。
---

# 模块生命周期（ModuleRunner）

> **TL;DR**：主进程横向系统能力一律实现 `AppModule` 接口（仅包含 `enable()` 方法），由微内核 `ModuleRunner` 串成顺序 Promise 链执行；系统能力可插拔，入口删一行即可整体卸载。

## 1. 选型理由

传统 Electron 项目极易演化为数千行的“巨石 `main.js`”：
- 窗口创建、系统托盘、自动更新、CSP 设置、单实例锁等逻辑全部混杂在 `app.whenReady()` 的嵌套回调中。
- 难以厘清模块间的初始化时序，删除或重构某项能力往往导致牵一发而动全身。

项目采用微内核架构将原生生命周期事件垂直切片，实现关注点完全分离。

## 2. 核心配置代码

### 极简模块协议（AppModule）

每个横向系统模块只关注自己的就绪逻辑，接口只有单一方法：

→ 源码：[packages/main/src/AppModule.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/AppModule.ts)

```ts
export interface AppModule {
  enable(context: ModuleContext): Promise<void> | void;
}
```

### 微内核链式驱动（ModuleRunner）

`ModuleRunner` 维护一条顺序 Promise 执行链，装配顺序即为真实初始化时序：

→ 源码：[packages/main/src/ModuleRunner.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/ModuleRunner.ts)

```ts
export class ModuleRunner {
  init(module: AppModule): this {
    const res = module.enable(this.createModuleContext());
    if (res instanceof Promise) {
      this.promise = this.promise.then(() => res);
    }
    return this;
  }
}
```

### 主进程入口的流水线装配

系统能力的启动完全声明式收拢在 `initApp` 中：

→ 源码：[packages/main/src/index.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/index.ts)

```ts
const moduleRunner = createModuleRunner()
  .init(createLogModule())                 // 1. 本地日志双写
  .init(createSentryModule())              // 2. 崩溃监控
  .init(createConfigModule())              // 3. 用户偏好持久化
  .init(createIPCModule())                 // 4. 控制器路由注册
  .init(createStartupReadinessModule())    // 5. 主进程就绪闩锁
  .init(createWindowManagerModule(...))    // 6. 窗口管理
  .init(createTrayModule())                // 7. 系统托盘
  .init(disallowMultipleAppInstance())     // 8. 单实例锁抢占
  .init(createContentSecurityPolicyModule()); // 9. CSP 安全头

await moduleRunner;
```

## 3. 桌面端避坑注意事项

- **模块装配顺序具有强因果依赖**：
  - 例如日志模块（`LogModule`）必须最先装配，确保后续所有模块初始化异常均可被捕获落盘；`StartupReadinessModule` 必须先于 `WindowManagerModule`，确保窗口渲染前就绪信号已完成就绪。
- **职责边界隔离（`modules/` vs `services/`）**：
  - `modules/` 仅承载横向基础设施与原生系统生命周期切片（如窗口、托盘、系统原生主题）；垂直业务逻辑一律归属于 `services/`，严禁在 `modules/` 中书写业务处理分支。
- **初始化异常阻断与 app.exit(1) 防僵尸驻留**：
  - 若某个核心前置模块在 `enable()` 中抛出 Rejected Promise，`initApp().catch()` 必须在记录日志后显式调用 `app.exit(1)`。切勿只打印错误而不退出，否则将留下一个无窗口、无 UI 响应却死死占着单实例锁与端口的系统后台僵尸进程。
- **模块注销与资源清理**：
  - 若模块持有长时间监听（如 `process.on` 或外部原生句柄），应在模块内部配合主进程退出信号主动注销，避免造成进程挂死。
