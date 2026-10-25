# 类型安全的跨进程契约

## 要解决的坑

Electron 的 IPC 默认是「裸」的：

- 通道名靠手拼字符串，改个名要全局搜索，拼错没有任何提示
- 参数不校验，渲染层传来的脏数据直插主进程业务逻辑
- 返回结构两边各说各话，成功和失败没有统一的形状
- 渲染层想调接口就得拿到整个 `ipcRenderer`，安全边界守不住

这套契约把通道、入参、返回值全部固化到 `@app/shared` 定义一次，主进程、preload、渲染层三方共用——编译期类型对不上就报错，运行期脏数据挡在边界外。

## 本仓库的解法

### 1. 通道名集中定义

→ 源码：[packages/shared/src/constants/ipc-channels.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/constants/ipc-channels.ts)

```ts
export const IPC_CHANNELS = {
  SYSTEM_PING: 'system:ping',
  COUNTER_GET: 'counter:get',
  COUNTER_INCREMENT: 'counter:increment',
  CONFIG_GET: 'config:get',
  CONFIG_UPDATE: 'config:update',
  // ...
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
```

通道只在这一处定义，业务代码里永远不出现字符串字面量。`as const` 加类型推导让「通道名」本身成为一个联合类型——别处想传不存在的通道，编译期就拦下。

### 2. 统一返回结构 Result&lt;T&gt;

→ 源码：[packages/shared/src/types/result.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/types/result.ts)

```ts
export type Result<T> =
  | { success: true; data: T; traceId?: string }
  | { success: false; error: string; code?: string; traceId?: string };
```

所有 IPC handler 的返回值都是这个形状：成功必带 `data`，失败必带 `error` 和语义化 `code`，二者互斥由类型系统保证。渲染层拿到返回值先看 `success`，窄化之后 TypeScript 自动知道该访问 `data` 还是 `error`，不需要到处 try/catch。

### 3. 入参用 zod schema 校验

→ 源码：[packages/shared/src/schemas/counter.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/schemas/counter.ts)

```ts
import { z } from 'zod';

export const stepInputSchema = z.object({
  step: z.number().int().min(1).max(100).default(1),
});

export type StepInput = z.infer<typeof stepInputSchema>;
```

schema 定义在 shared，类型用 `z.infer` 从 schema 推导——只有一份定义，不会出现「schema 和类型各写一份、改了不同步」。

主进程的 Controller 在边界处校验，通过后才进业务：

→ 源码：[packages/main/src/controllers/counter.controller.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/controllers/counter.controller.ts)

```ts
handleTraced(
  IPC_CHANNELS.COUNTER_INCREMENT,
  async (_event, rawInput: unknown): Promise<Result<CounterResult>> => {
    const parseResult = stepInputSchema.safeParse(rawInput ?? {});
    if (!parseResult.success) {
      return failResult(parseResult.error.issues[0].message, ErrorCode.VALIDATION_ERROR);
    }
    try {
      return successResult(counterService.increment(parseResult.data.step));
    } catch (err) {
      return catchToResult(err);
    }
  },
);
```

handler 收到的入参类型标成 `unknown` 而不是 `StepInput`——跨进程来的数据在过 schema 之前一律当作不可信，校验通过后 `parseResult.data` 才是干净数据。

### 4. contextBridge 白名单暴露

→ 源码：[packages/preload/src/index.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/preload/src/index.ts)

```ts
export const apiBridge: ElectronApi = {
  counter: {
    get: () => invokeTraced(IPC_CHANNELS.COUNTER_GET),
    increment: (input?: StepInput) => invokeTraced(IPC_CHANNELS.COUNTER_INCREMENT, input),
    decrement: (input?: StepInput) => invokeTraced(IPC_CHANNELS.COUNTER_DECREMENT, input),
    reset: () => invokeTraced(IPC_CHANNELS.COUNTER_RESET),
  },
  // ...其余域同样按白名单列明
};

contextBridge.exposeInMainWorld('api', apiBridge);
```

渲染进程永远拿不到 `ipcRenderer`，能调什么完全由 `apiBridge` 列明。`ElectronApi` 类型同样来自 shared，所以 `window.api.counter.increment({ step: 5 })` 在渲染层有完整的参数与返回类型提示。

## 怎么抄

以「新增一个 IPC 接口」为例，四步：

1. **shared 定义契约**：`IPC_CHANNELS` 加通道、新建 zod schema、定义返回类型
2. **main 写 Controller**：`handleTraced` 挂 handler，`safeParse` 校验入参，返回值统一包成 `Result<T>`；业务逻辑放 Service，保持可脱离 Electron 单测
3. **preload 加白名单**：`apiBridge` 里加方法，类型标注 `ElectronApi`
4. **renderer 直接调用**：`const res = await window.api.counter.increment({ step: 5 })`，按 `res.success` 分支处理

注意点：

- 通道字符串只在 `IPC_CHANNELS` 一处出现，任何业务代码里的裸字符串都算违规
- 入参类型一律 `z.infer` 推导，不手写第二份
- 校验放在 Controller（边界层），Service 收到的永远是过完 schema 的数据
- 新能力必须显式加桥——「渲染层突然能调一个没人批过的接口」在这个结构下不会发生
