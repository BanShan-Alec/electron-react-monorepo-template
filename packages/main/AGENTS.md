# @app/main AGENTS.md — 主进程规则（AI 必读）

> 人类向概览见 [README.md](./README.md)；全局红线与全仓任务路由见 [根 AGENTS.md](../../AGENTS.md)（其中三条全局红线在本包同样适用）。
> 本文件是该包规则的唯一真源：README 不再承载目录树 / 铁律 / 严禁清单 / SOP。

## 1. 目录结构（packages/main/src/）

```
packages/main/src/
├── index.ts              # 进程主入口：未捕获异常兜底 + ModuleRunner 流水线组装
├── ModuleRunner.ts       # 模块启动器：按序驱动各 AppModule 生命周期
├── AppModule.ts          # 模块接口定义：enable(context): Promise<void> | void
├── AppInitConfig.ts      # 进程装配输入（窗口条目、开发服务器地址等）
├── ModuleContext.ts      # 模块上下文（当前注入 app）
├── env.ts                # 环境门面：MODE 与运行时配置的权威读取点
├── lifecycle.ts          # 应用级生命周期判定（如末窗口关闭行为）
├── controllers/          # 通信接入层：IPC 路由监听、Zod 校验、异常包装（统一经 handleTraced 注册）
│   ├── index.ts          # registerAllControllers()：显式集中挂载所有 Controller
│   ├── utils.ts          # successResult / failResult / catchToResult 包装原语
│   └── <domain>.controller.ts
├── services/             # 核心业务层：纯逻辑与系统 API 调用（单例模式）
│   └── <domain>.service.ts
├── telemetry/            # 全链路追踪：tracer（AsyncLocalStorage）、ipc-tracer（handleTraced）、window-tracer
├── modules/              # 系统切片层：窗口、托盘、日志、主题、IPC、单实例、安全等
│   ├── *.module.ts       # AppModule 生命周期单元
│   ├── window/           # 窗口注册表、标题栏 overlay、无边框重绘、官方状态持久化、更新窗口
│   └── security/         # CSP、导航来源白名单、外链白名单
└── errors/               # 领域异常定义（如 AppError）
```

## 2. 依赖方向（单向流动）

| 目录/文件 | 核心职责 | 依赖方向 |
| :--- | :--- | :--- |
| `controllers/` | 监听 IPC 请求，执行参数反序列化与校验，转发至 Service 并统一返回 `Result<T>` | 依赖 `services/`、`telemetry/`、`@app/shared` |
| `services/` | 实现纯粹业务逻辑与 Node.js / Electron 原生 API 调用，禁止感知 IPC 协议细节 | **严禁**依赖 `controllers/` 或 IPC |
| `modules/` | 实现 `AppModule` 接口的横向独立功能块，由 `ModuleRunner` 统一按序装配 | 依赖 `services/`、`telemetry/`、系统 API |

## 3. 核心架构铁律（AI / 开发者必须遵守）

1. **单向调用禁止逆流**：
   - 依赖链路严格限制为：`IPC 事件 ➔ Controller ➔ Service`。
   - **Service 严禁感知 IPC**：Service 方法签名必须是纯数据输入和纯返回，绝对不得引入 `ipcMain`、`IpcMainInvokeEvent` 或直接向渲染端回发消息。
2. **入参必须通过 Zod 校验**：
   - Controller 入口必须使用 `@app/shared/schemas` 提供的 Schema 进行 `.safeParse(rawInput)` 校验，校验失败立刻通过 `failResult` 拦截返回，禁止让脏数据进入 Service。
3. **IPC 返回值必须统一包装为 `Result<T>`**：
   - Controller 的 handle 必须用 `try...catch` 包裹或使用 `catchToResult(err)`，严禁向前端抛出未捕获的 Promise rejection 或裸数据。
4. **统一显式注册，严禁裸写 IPC**：
   - 严禁在 `index.ts`、Service 或 Module 内分散裸写 `ipcMain.handle`。
   - 所有 IPC 注册函数必须统一命名为 `register<Domain>Controllers()`，并在 `controllers/index.ts` 中显式挂载。
5. **单例与无状态原则**：
   - Service 以单例对象（`export const xxxService = new XxxService()`）导出，保持无状态或自闭环状态，严禁在外部直接突变 Service 内部属性。

## 4. AI 编码严禁清单 (Anti-Patterns)

- ❌ **禁止在 Controller 中写实质业务**（如操作数据库、复杂运算、读写文件），Controller 只做参数校验、调用与返回。
- ❌ **禁止裸传错误**：不得返回裸 Error 对象，必须映射为带 `ErrorCode` 的 `Result<never>`。
- ❌ **禁止反向依赖 Renderer**：主进程代码仅消费 `@app/shared`。唯一合法例外：`index.ts` 进程装配阶段经 `require.resolve('@app/renderer')` / `require.resolve('@app/renderer/updater')` 获取生产静态 HTML 产物物理路径。
- ❌ **禁止遗漏原生模块 external 对齐**：主进程声明的生产依赖必须 100% 在 `packages/main/vite.config.ts` 的 `rolldownOptions.external` 中排除，由 CI 门禁 `pnpm verify:deps` 自动保护（规范见 [docs/dependency-rules.md](../../docs/dependency-rules.md)）。`@sentry/electron` 是 devDependency、经 `ssr.noExternal` 主动内联，不在 external 之列，不构成违例。

## 5. 新增业务领域标准开发范式 (SOP)

以新增 `notes`（便签）领域为例，AI 和开发者请严格按以下模版编写：

### Step 1: 编写 Service (`services/notes.service.ts`)

```typescript
import { AppError } from '../errors/AppError';
import { ErrorCode } from '@app/shared/constants/error-codes';
import type { CreateNoteInput } from '@app/shared/schemas/notes';
import type { NoteItem } from '@app/shared/types/notes';

export class NotesService {
  async create(input: CreateNoteInput): Promise<NoteItem> {
    if (!input.title) {
      throw new AppError('Title is required', ErrorCode.VALIDATION_ERROR);
    }
    // 纯业务逻辑 / 文件持久化 / 数据处理...
    return { id: 'note-1', title: input.title, content: input.content, createdAt: Date.now() };
  }
}

export const notesService = new NotesService();
```

### Step 2: 编写 Controller (`controllers/notes.controller.ts`)

```typescript
import { ErrorCode } from '@app/shared/constants/error-codes';
import { IPC_CHANNELS } from '@app/shared/constants/ipc-channels';
import { createNoteInputSchema } from '@app/shared/schemas/notes';
import type { NoteItem } from '@app/shared/types/notes';
import type { Result } from '@app/shared/types/result';
import { handleTraced } from '../telemetry/ipc-tracer';
import { notesService } from '../services/notes.service';
import { catchToResult, failResult, successResult } from './utils';

export function registerNotesControllers(): void {
  handleTraced(
    IPC_CHANNELS.NOTES_CREATE,
    async (_event, rawInput: unknown): Promise<Result<NoteItem>> => {
      const parseResult = createNoteInputSchema.safeParse(rawInput ?? {});
      if (!parseResult.success) {
        return failResult(parseResult.error.issues[0].message, ErrorCode.VALIDATION_ERROR);
      }
      try {
        const result = await notesService.create(parseResult.data);
        return successResult(result);
      } catch (err) {
        return catchToResult(err);
      }
    },
  );
}
```

> **必须走 `handleTraced`，严禁裸写 `ipcMain.handle`**（2026-10-18 立；唯一架构豁免：`IPC_CHANNELS.DIAGNOSTICS_LOG` 作为日志落盘底层管道，禁止包裹 `handleTraced`，避免日志双写引发 span 与 trace 循环自噪）：`handleTraced` 负责解包 preload 传入的 `__trace_carrier`、创建 `ipc.receive:<channel>` span，并把返回的 `Result` 成败记录为 span 属性。裸写会静默丢失全链路追踪。handler 第二形参是解包后的数据（故示例用 `rawInput` 直接校验）。

### Step 3: 在 `controllers/index.ts` 登记挂载

```typescript
import { registerNotesControllers } from './notes.controller';

export function registerAllControllers(): void {
  // ...已有 controllers
  registerNotesControllers();
}
```

## 6. 提交前门禁

根目录执行：`pnpm typecheck` · `pnpm lint` · `pnpm test`（与 CI 同款检查，本地先过再推送）；
改动主进程生产依赖或 vite external 后追加 `pnpm verify:deps`。
