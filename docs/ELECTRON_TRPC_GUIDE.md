# Electron-tRPC 架构解析与深度玩法指南

> 打造现代 Electron 应用端到端 100% 类型安全的进程间通信 (IPC) 架构。

---

## 1. 为什么需要 electron-trpc？

### 1.1 传统 Electron IPC 通信的痛点

在传统的 Electron 应用中，渲染进程（Renderer Process）与主进程（Main Process）之间的通信通常依赖 `ipcRenderer.invoke` 与 `ipcMain.handle`：

```ts
// ❌ 传统方式的隐患

// 1. 主进程定义监听 (纯字符串频道)
ipcMain.handle('get-system-info', async (event, options) => {
  return { platform: process.platform, memory: process.memoryUsage() };
});

// 2. Preload 脚本手动挂载白名单
contextBridge.exposeInMainWorld('api', {
  getSystemInfo: (options) => ipcRenderer.invoke('get-system-info', options),
});

// 3. 渲染进程调用 (无编译期约束)
const info = await window.api.getSystemInfo({ detail: true });
```

这种模式在规模化开发中暴露出显著痛点：
1. **频道字符串脆弱**：`get-system-info` 极易拼写错误，排查困难。
2. **缺乏类型保障**：没有端到端的类型推导，修改主进程返回结构时，渲染进程无法感知潜在的破坏性变更（Breaking Changes）。
3. **双重维护成本**：为了获得 TypeScript 提示，开发者必须手写大量的 `.d.ts` 接口声明文件。
4. **缺乏统一的 Schema 校验**：难以拦截非法入参，容易造成主进程异常崩溃。

---

### 1.2 tRPC + Electron 带来的革新

`electron-trpc` 将业界主流的 **tRPC (TypeScript Remote Procedure Call)** 思想引入了 Electron：

* **零 API 接口文件 / 零代码生成**：直接基于 TypeScript 静态推导，无需 GraphQL 或 Protobuf 生成脚手架。
* **端到端类型安全 (End-to-End Type Safety)**：主进程声明好 Router，前端直接享受代码补全与参数/返回值强约束。
* **原生安全兼容**：完全支持 Electron 官方推荐的 `contextIsolation: true` 与沙箱模式。
* **强大的验证体系**：开箱即用支持 `zod`、`valibot`、`yup` 等库对请求入参进行严格校验。

---

## 2. 核心架构与通信流程

```mermaid
sequenceDiagram
    autonumber
    actor User as 用户界面 (React / Vue)
    participant Client as tRPC Proxy Client
    participant Link as ipcLink()
    participant Bridge as Preload (exposeElectronTRPC)
    participant Handler as Main (createIPCHandler)
    participant Router as AppRouter (zod + procedures)

    User->>Client: 调用 trpc.getSystemInfo.query()
    Client->>Link: 序列化为 tRPC 请求包
    Link->>Bridge: window.electronTRPC.sendMessage(op)
    Bridge->>Handler: ipcRenderer.send('electron-trpc', op)
    Handler->>Router: 分发至对应 procedure 并通过 zod 验证
    Router-->>Handler: 执行业务逻辑并返回结果
    Handler-->>Bridge: event.sender.send('electron-trpc', response)
    Bridge-->>Link: window.electronTRPC.onMessage(callback)
    Link-->>Client: 反序列化并校验
    Client-->>User: 返回类型安全的 Data 对象
```

---

## 3. 架构三件套实战搭建

### 步骤 1：主进程（Main Process）—— 定义 Router 与启动 Handler

在 `@app/main` 中创建路由体系：

```ts
// packages/main/src/router/index.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import os from 'node:os';

const t = initTRPC.create();
export const router = t.router;
export const publicProcedure = t.procedure;

// 定义应用 Router
export const appRouter = router({
  // 1. 无参 Query
  ping: publicProcedure.query(() => {
    return { message: 'pong', timestamp: Date.now() };
  }),

  // 2. 带 Zod 验证的 Query
  getUserById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input }) => {
      return { id: input.id, name: 'Alice' };
    }),

  // 3. 变更操作 Mutation
  updateSetting: publicProcedure
    .input(z.object({ theme: z.enum(['light', 'dark', 'system']) }))
    .mutation(({ input }) => {
      // 执行持久化存储或主进程逻辑
      return { success: true, theme: input.theme };
    }),
});

// 导出 Router 类型定义（供前端仅按类型导入）
export type AppRouter = typeof appRouter;
```

在主进程生命周期中启动 Handler：

```ts
// packages/main/src/modules/TRPCModule.ts
import { createIPCHandler } from 'electron-trpc/main';
import { appRouter } from '../router/index.js';
import { app, BrowserWindow } from 'electron';

export function setupTRPC() {
  const handler = createIPCHandler({ router: appRouter });

  // 确保新打开的窗口自动挂载通信通道
  app.on('browser-window-created', (_event, window) => {
    handler.attachWindow(window);
  });

  return handler;
}
```

---

### 步骤 2：预加载脚本（Preload Process）—— 暴露安全通信管道

在 `packages/preload/src/exposed.ts` 中引入并调用 `exposeElectronTRPC`：

```ts
import { exposeElectronTRPC } from 'electron-trpc/main';

// 在预加载环境中暴露 window.electronTRPC 桥梁
process.once('loaded', async () => {
  exposeElectronTRPC();
});
```

> **底层原理**：`exposeElectronTRPC` 内部通过 `contextBridge.exposeInMainWorld('electronTRPC', { ... })` 仅暴露发送与接收方法，不会泄漏任何 Node.js 原生 API，严格遵循最小特权安全模型。

---

### 步骤 3：渲染进程（Renderer Process）—— 初始化 Proxy Client

在 `@app/renderer` 中初始化 tRPC 客户端：

```ts
// packages/renderer/src/trpc.ts
import { createTRPCProxyClient } from '@trpc/client';
import { ipcLink } from 'electron-trpc/renderer';
import type { AppRouter } from '@app/main/router'; // 仅以类型导入！

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
});
```

在组件（React / Vue）中消费：

```tsx
// packages/renderer/src/App.tsx
import { useEffect, useState } from 'react';
import { trpc } from './trpc';

export function MyComponent() {
  const [data, setData] = useState<string>('');

  useEffect(() => {
    async function load() {
      // 获得完全自动补全：ping, getUserById, updateSetting
      const res = await trpc.ping.query();
      setData(res.message); // 自动推断为 string 类型！
    }
    load();
  }, []);

  const handleUpdate = async () => {
    // 若入参类型不匹配，TypeScript 将直接编译报错！
    await trpc.updateSetting.mutate({ theme: 'dark' });
  };

  return <div>{data}</div>;
}
```

---

## 4. 六大进阶玩法与模式

### 玩法 1：上下文（Context）机制与身份溯源
tRPC 允许为每个请求创建上下文（Context），在 Electron 中这能非常方便地获取触发请求的 `BrowserWindow` 或 `WebContents`：

```ts
// packages/main/src/router/context.ts
import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateContextOptions } from 'electron-trpc/main';
import { BrowserWindow } from 'electron';

export function createContext(opts: CreateContextOptions) {
  const window = BrowserWindow.fromWebContents(opts.event.sender);
  return {
    window,
    senderId: opts.event.sender.id,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
```

在 Procedure 中使用 Context：

```ts
const t = initTRPC.context<Context>().create();

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.window) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: '无效的窗口上下文' });
  }
  return next({ ctx });
});
```

---

### 玩法 2：主进程系统与硬件特权操作
在主进程中安全包装桌面应用专属操作（窗口缩放、系统通知、原生对话框、外部链接）：

```ts
export const appRouter = router({
  selectFile: publicProcedure
    .input(z.object({ title: z.string().default('选择文件') }))
    .mutation(async ({ input, ctx }) => {
      const { dialog } = await import('electron');
      const result = await dialog.showOpenDialog(ctx.window!, {
        title: input.title,
        properties: ['openFile'],
      });
      return { filePaths: result.filePaths, canceled: result.canceled };
    }),

  toggleDevTools: publicProcedure.mutation(({ ctx }) => {
    ctx.window?.webContents.toggleDevTools();
    return { opened: ctx.window?.webContents.isDevToolsOpened() };
  }),
});
```

---

### 玩法 3：运行时 Schema 校验与严密防错
借助 Zod 的丰富表达力，可以轻松验证复杂的数据结构、文件路径、URL、枚举和区间：

```ts
export const appRouter = router({
  saveUserData: publicProcedure
    .input(
      z.object({
        email: z.string().email('邮箱格式不正确'),
        age: z.number().int().min(0).max(150),
        tags: z.array(z.string()).max(5),
      })
    )
    .mutation(async ({ input }) => {
      // 业务逻辑：此时 input 已通过校验，必定符合上述结构
    }),
});
```

---

### 玩法 4：统一异常拦截与错误码
tRPC 具备标准的 HTTP-like 错误体系。当主进程抛出 `TRPCError` 时，渲染进程能够获得统一的错误类型和错误提示：

```ts
// Main 进程
if (isLocked) {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: '该数据库文件正在被其他进程锁定',
  });
}

// Renderer 进程
try {
  await trpc.readDatabase.query();
} catch (err: any) {
  console.error('Error Code:', err.data?.code); // 'FORBIDDEN'
  console.error('Message:', err.message);       // '该数据库文件正在被其他进程锁定'
}
```

---

### 玩法 5：无缝接入 @tanStack/react-query
如果希望获得如同网页开发一样的声明式缓存、SWR 自动重连、Loading/Error 状态，可直接搭配 `@trpc/react-query` 使用：

```tsx
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@app/main/router';

export const trpcReact = createTRPCReact<AppRouter>();

function SystemDashboard() {
  const { data, isLoading, refetch } = trpcReact.getSystemInfo.useQuery();

  if (isLoading) return <div>加载主进程信息中...</div>;
  return <div>Node Version: {data?.nodeVersion}</div>;
}
```

---

### 玩法 6：多窗口（Multi-Window）协同
在多窗口桌面应用（如主界面 + 悬浮窗 + 设置窗口）中，通过生命周期监听器自动统一管理 IPC 连接：

```ts
// 监听 BrowserWindow 创建事件，自动绑定
app.on('browser-window-created', (_event, window) => {
  handler.attachWindow(window);
});

// 在窗口关闭时自动释放资源
window.on('closed', () => {
  handler.detachWindow(window);
});
```

---

## 5. 常见问题与排坑指南 (FAQ & Troubleshooting)

### Q1: 渲染进程引入 `@app/main` 会把 Node.js 代码打包进前端吗？
**不会！** 请务必使用 **类型仅导入（Type-only import）** 语法：
```ts
import type { AppRouter } from '@app/main/router';
```
TypeScript 编译阶段会将所有的 `import type` 完全擦除（Tree-shaking / Type Elision），打包后的前端代码完全没有任何主进程模块或 Node.js 引用。

### Q2: 报错 `Option 'baseUrl' is deprecated` 或 `verbatimModuleSyntax` 错误？
* 在 TypeScript 6+ 中，如果出现 `TS5101: Option 'baseUrl' is deprecated`，可以在 `tsconfig.json` 中配置 `"ignoreDeprecations": "6.0"`。
* 开启 `"verbatimModuleSyntax": true` 时，任何作为类型的导出/导入必须显式使用 `export type` 或 `import type`。

### Q3: 为什么不要在 Electron 中开启 `nodeIntegration: true`？
直接在渲染进程启用 `nodeIntegration` 会允许恶意脚本（如 XSS 注入或引用的第三方 CDN 库）直接获取主机的 Shell 执行权限。使用 `electron-trpc` 既能保留与 Node 原生完全一样的强类型开发体验，又能保持沙箱安全性。

---

## 6. 总结

`electron-trpc` 将现代 Web 全栈开发的顶尖开发体验（DX）原汁原味带到了 Electron 桌面开发中：
* **更少的心智负担**：告别字符串 IPC 频道与繁琐的 preload 白名单。
* **更高的代码健壮性**：前后端重构时，任何接口变更在按下保存的一瞬间即可在前端获得编译反馈。
* **极致的安全保障**：严格契合 Electron 最新安全实践。
