---
title: 模块生命周期（ModuleRunner）
description: "每个系统能力实现只含 `enable()` 的模块，由 ModuleRunner 串成顺序 Promise 链，删一行即整体退场。"
---

# 模块生命周期（ModuleRunner）

> **TL;DR**：每个系统能力实现只含 `enable()` 的模块，由 ModuleRunner 串成顺序 Promise 链，删一行即整体退场。

## 要解决的坑

Electron 项目最容易长歪的地方就是组织方式：

- 主进程长成千行 `main.js`：窗口、托盘、IPC、单实例锁、安全策略糊在入口文件里，按 app 生命周期事件的时间线互相纠缠，动一处牵全身

## 本仓库的解法

### 4. 生命周期解耦：ModuleRunner 微内核，原生事件拆成可插拔模块

→ 源码：[packages/main/src/AppModule.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/AppModule.ts)

```ts
export interface AppModule {
  enable(context: ModuleContext): Promise<void> | void;
}
```

模块接口只有一个 `enable()`。每个系统能力各自实现 `AppModule`，在自己的 `enable()` 里订阅需要的原生事件：

→ 源码：[packages/main/src/modules/single-instance.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/single-instance.module.ts)

```ts
export class SingleInstanceApp implements AppModule {
  enable({ app }: { app: Electron.App }): void {
    const isSingleInstance = app.requestSingleInstanceLock();
    if (!isSingleInstance) {
      // 抢锁失败最常见成因：上一实例关闭主窗口后退守托盘、仍持有锁。
      // 一条 log.warn 同时落盘 main.log 并经控制台 transport 回显到终端
      const message =
        'Cannot acquire single instance lock: another instance is running (check the tray icon). Exiting.';
      getLogManager().scoped(this).warn(message);
      app.quit();
      process.exit(0);
    }
  }
}
```

ModuleRunner 把模块串成顺序 Promise 链，`.init()` 链式返回自身；它还实现了 `PromiseLike`，入口处一行 `await moduleRunner` 收敛整条链：

→ 源码：[packages/main/src/ModuleRunner.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/ModuleRunner.ts)

```ts
init(module: AppModule) {
  const p = module.enable(this.createModuleContext());

  if (p instanceof Promise) {
    this.promise = this.promise.then(() => p);
  }

  return this;
}
```

装配集中在主进程入口，链位即依赖顺序：

→ 源码：[packages/main/src/index.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/index.ts)

```ts
const moduleRunner = createModuleRunner()
  .init(createLogModule())
  .init(createSentryModule())
  .init(createConfigModule())
  .init(createNativeThemeModule())
  .init(createIPCModule())
  // 主进程就绪源：链位在 WindowManager 之前，信号先于窗口与壳（spec §4.6 / ADR-0003）
  .init(createStartupReadinessModule())
  .init(createWindowManagerModule({ initConfig }))
  .init(createUpdaterWindowModule({ initConfig }))
  .init(createTrayModule())
  .init(disallowMultipleAppInstance())
  .init(terminateAppOnLastWindowClose())

  // Security
  .init(createContentSecurityPolicyModule())
  // ...导航来源白名单与外链白名单两行省略

await moduleRunner;
```

传统写法是在 `main.js` 顶层按事件时间线铺代码：`app.whenReady` 里建窗口、建托盘、注册 IPC，时间一长就是按时间组织的祖传文件。这里按关注点垂直切：单实例是一个模块、托盘是一个模块、CSP 是一个模块。加一个系统能力 = 新建 module 文件 + 流水线加一行；删掉 `createTrayModule()` 那一行，托盘连同它的原生事件订阅整体退场。模块依赖显式注入——`ModuleContext` 当前只带 `readonly app`。

→ 源码：[packages/main/src/ModuleContext.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/ModuleContext.ts) · [packages/main/src/modules/](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules)

注意点：

- `modules/` 只放横向系统能力（生命周期单元），业务纵向逻辑住 `services/`，别把业务塞进模块
