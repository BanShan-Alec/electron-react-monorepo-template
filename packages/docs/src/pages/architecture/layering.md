---
title: 分层架构（Controller / Service）
description: IPC 事件只进 Controller，业务住 Service，纯逻辑服务不 import Electron，可在 node 环境直接单测。
---

# 分层架构（Controller / Service）

> **TL;DR**：IPC 事件只进 Controller，业务住 Service，纯逻辑服务不 import Electron，可在 node 环境直接单测。

## 要解决的坑

Electron 项目最容易长歪的地方就是组织方式：

- 业务逻辑和 `ipcMain.handle` 糊在同一个函数里，想单测一段业务都得先拉起 Electron

## 本仓库的解法

### 分层纪律：Controller/Service 分离，业务可脱离 Electron 单测

主进程纵向三层：`controllers/` 通信接入、`services/` 核心业务、`modules/` 系统切片。铁律是依赖只能单向流动 `IPC 事件 → Controller → Service`：Service 方法签名纯数据进出，不出现 `ipcMain`、事件对象，也不向渲染端回发消息。

→ 源码：[packages/main/src/controllers/counter.controller.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/controllers/counter.controller.ts)

```ts
export function registerCounterControllers(): void {
  handleTraced(IPC_CHANNELS.COUNTER_GET, async (): Promise<Result<CounterResult>> => {
    try {
      return successResult(counterService.getCounter());
    } catch (err) {
      return catchToResult(err);
    }
  });
  // ...其余 handler 同构：有入参的经 zod safeParse 校验，返回统一包成 Result<T>（无入参的仅做包装）
}
```

Controller 只做三件事：校验入参、调用 Service、把结果包成 `Result<T>`，不写实质业务。业务住在 Service：

→ 源码：[packages/main/src/services/counter.service.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/services/counter.service.ts)

```ts
export class CounterService {
  getCounter(): CounterResult {
    const store = getAppConfigStore();
    return { count: store.get('serverCounter') };
  }

  increment(step = 1): CounterResult {
    const store = getAppConfigStore();
    const newCount = store.get('serverCounter') + step;
    store.set({ serverCounter: newCount });
    return { count: newCount, step };
  }

  // ...decrement() / reset() 省略：同为「读写 store、返回 CounterResult」模式
}

export const counterService = new CounterService();
```

IPC 注册集中显式：所有 handler 必须经 `register<Domain>Controllers()` 在一处挂载，入口、Service、Module 里禁止裸写 `ipcMain.handle`：

→ 源码：[packages/main/src/controllers/index.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/controllers/index.ts)

```ts
export function registerAllControllers(): void {
  registerSystemControllers();
  registerUsbControllers();
  registerCounterControllers();
  registerCalculatorControllers();
  registerConfigControllers();
  registerDiagnosticsControllers();
  registerDialogControllers();
  registerUpdaterControllers();
}
```

「业务可脱离 Electron 单测」的实据是纯逻辑服务不 import electron——`classifyUpdaterError` 只依赖 `AppError` 与错误码常量，它的单测在 Vitest node 环境直接运行，不需要启动 Electron：

→ 源码：[packages/main/src/services/updater-classify.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/services/updater-classify.ts) · [packages/main/tests/unit/updater-classify.test.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/tests/unit/updater-classify.test.ts)

```ts
export function classifyUpdaterError(err: unknown, fallback: ErrorCodeType): ErrorCodeType {
  if (err instanceof AppError) {
    return err.code as ErrorCodeType;
  }
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('net::ERR_')) {
    return ErrorCode.UPDATER_NETWORK_ERROR;
  }
  return fallback;
}
```

设计动机：IPC 是外部边界，不是业务本体。把「跨进程」锁死在 Controller 一层，Service 才是可积累、可测试的资产；需要系统能力的服务（如经 `config.module` 持久化的 counter.service）把 electron API 压在少数取数点后面，业务分支本身仍不与 Electron 类型纠缠。规则真源：`packages/main/AGENTS.md`（依赖方向与核心铁律）。

## 怎么抄

以新增一个业务域（如 counter）为例，六步：

本页覆盖第 1–4 步，渲染层与上架步骤见[功能域组织（Features）](/architecture/feature-domains)。

1. **shared 定义契约**：`IPC_CHANNELS` 加通道、zod schema、返回类型（详见[类型安全的 IPC 契约（Zod + ContextBridge）](/security/ipc-contract)一文）
2. **main 写 Service**：`services/<domain>.service.ts` 纯业务逻辑，单例导出
3. **main 写 Controller**：`controllers/<domain>.controller.ts` 经 `handleTraced` 注册，safeParse 校验、`Result<T>` 包装；`controllers/index.ts` 登记一行
4. **preload 加白名单**：`apiBridge` 加方法（详见[类型安全的 IPC 契约（Zod + ContextBridge）](/security/ipc-contract)一文）

注意点：

- 严禁裸写 `ipcMain.handle`，所有 handler 走 `register<Domain>Controllers()` 集中挂载
- Service 不感知 IPC：签名纯数据进出，electron 系统能力集中在少数显式取数点
