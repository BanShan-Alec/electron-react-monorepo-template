# @app/main AGENTS.md — 主进程规则（AI 必读）

> 全局红线与全仓任务路由见 [根 AGENTS.md](../../AGENTS.md)。本文件为该包规则唯一真源。

## 1. 分层架构与隐形陷阱

主进程严格遵循 Controller / Service / Module 三层单向流动架构：

| 目录/切片 | 核心职责 | 依赖方向与约束 | 隐形陷阱 / 机器门禁 |
| :--- | :--- | :--- | :--- |
| `controllers/` | 统一监听 IPC、Zod 校验入参、转发 Service | 依赖 `services/`、`telemetry/`、`@app/shared` | 必须集中在 `controllers/index.ts` 显式挂载，严禁裸写 `ipcMain.handle` |
| `services/` | 纯业务逻辑与 Node.js / Electron 原生 API 调用 | 纯数据输入/输出，**严禁**感知 IPC 协议细节 | 单例对象导出（`export const xxxService = new XxxService()`），保持无状态 |
| `modules/` | 实现 `AppModule` 接口的横切系统切片（窗口、托盘、CSP、单实例） | 由 `ModuleRunner` 在 `index.ts` 中统一按序装配 | 依赖生命周期时序，末窗口行为由 `lifecycle.ts` 裁决 |
| `telemetry/` | 基于 AsyncLocalStorage 的 W3C Trace 全链路追踪 | 提供 `handleTraced` IPC 包装原语 | 必须经 `handleTraced` 提取 `__trace_carrier` 创建 span，裸写会导致链路断裂 |

## 2. 核心架构铁律

1. **单向调用禁止逆流**：依赖链路严格遵循 `IPC 事件 ➔ Controller ➔ Service`，Service 严禁引入 `ipcMain`、`IpcMainInvokeEvent` 或向渲染端回推消息。
2. **入参必须通过 Zod 校验**：Controller 入口必须使用 `@app/shared/schemas` 进行 `.safeParse(rawInput)` 校验，非法入参直接通过 `failResult` 拦截。
3. **IPC 返回值必须统一包装为 `Result<T>`**：Controller 必须使用 `catchToResult(err)` 或 `try...catch` 兜底，严禁向前端抛出未捕获异常。
4. **统一经 handleTraced 显式注册**：所有通信入口命名为 `register<Domain>Controllers()` 并在 `controllers/index.ts` 挂载。
   - **架构唯一豁免**：`IPC_CHANNELS.DIAGNOSTICS_LOG` 作为日志落盘底层管道，禁止包裹 `handleTraced`，避免日志双写引发 span 循环自噪。

## 3. Anti-Patterns（避坑清单）

- **Controller 越界实现业务** — 在 Controller 中写复杂计算、文件读写或数据库操作；业务必须下沉到 Service。
- **返回裸 Error 对象** — 必须映射为带 `ErrorCode` 的 `Result<never>`，杜绝向渲染端抛出未捕获 Promise rejection。
- **反向依赖 Renderer 源码** — 主进程代码仅消费 `@app/shared`，严禁 import 渲染层源码（唯一例外：`index.ts` 装配时经 `require.resolve` 动态定位编译产物 HTML 物理路径）。
- **漏配 external 导致打包污染** — 主进程生产依赖必须 100% 在 `packages/main/vite.config.ts` 的 `rolldownOptions.external` 中排除（门禁：CI `pnpm verify:prebuild` 拦截；`@sentry/electron` 经 `ssr.noExternal` 主动内联除外）。

## 4. 新增业务领域开发范式 (SOP 紧凑签名)

完整开发指南见 [架构分层与生命周期](../../packages/docs/src/pages/architecture/layering.md)。开发新领域时仅需遵循紧凑骨架：

```typescript
// 1. Service (services/<domain>.service.ts - 纯逻辑单例，零 IPC 依赖):
export class NotesService {
  async create(input: CreateNoteInput): Promise<NoteItem> { /* 纯逻辑 */ return { id: 'note-1', ...input }; }
}
export const notesService = new NotesService();

// 2. Controller (controllers/<domain>.controller.ts - 参数校验 + handleTraced + 异常包装):
export function registerNotesControllers(): void {
  handleTraced(IPC_CHANNELS.NOTES_CREATE, async (_event, rawInput: unknown): Promise<Result<NoteItem>> => {
    const parseResult = createNoteInputSchema.safeParse(rawInput ?? {});
    if (!parseResult.success) return failResult(parseResult.error.issues[0].message, ErrorCode.VALIDATION_ERROR);
    try { return successResult(await notesService.create(parseResult.data)); } catch (err) { return catchToResult(err); }
  });
}

// 3. 集中挂载 (controllers/index.ts):
export function registerAllControllers(): void { registerNotesControllers(); }
```

## 5. 提交前门禁

- 根目录执行：`pnpm typecheck` · `pnpm lint` · `pnpm test`。
- 修改主进程生产依赖或 Vite 配置后，必须本地执行并通过：`pnpm verify:prebuild`。
