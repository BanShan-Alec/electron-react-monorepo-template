# @app/main 主进程架构规范与 AI 开发指南

主进程充当运行在 Node.js 环境下的**本地微型后端**，负责操作系统底层交互、窗口生命周期管理以及对渲染进程提供强契约的 IPC 接口。

---

## 1. 目录职责总览

```
packages/main/src/
├── index.ts              # 进程主入口：未捕获异常兜底 + ModuleRunner 流水线组装
├── ModuleRunner.ts       # 模块启动器：按顺序驱动各 AppModule 的生命周期
├── AppModule.ts          # 模块接口定义：enable(context): Promise<void> | void
├── controllers/          # 通信接入层：负责 IPC 路由监听、Zod 参数校验、异常包装
│   ├── index.ts          # registerAllControllers()：显式集中挂载所有 Controller
│   ├── utils.ts          # successResult / failResult / catchToResult 包装原语
│   └── <domain>.controller.ts
├── services/             # 核心业务层：纯逻辑与系统 API 调用（单例模式）
│   └── <domain>.service.ts
├── modules/              # 系统切片层：窗口管理、托盘、系统日志、安全沙箱、自动更新
└── errors/               # 领域异常定义（如 AppError）
```

| 目录/文件 | 核心职责 | 依赖方向（单向流动） |
| :--- | :--- | :--- |
| `controllers/` | 监听 IPC 请求，执行参数反序列化与校验，转发至 Service 并统一返回 `Result<T>` | 依赖 `services/`、`@app/shared` |
| `services/` | 实现纯粹业务逻辑与 Node.js / Electron 原生 API 调用，禁止感知 IPC 协议细节 | **严禁**依赖 `controllers/` 或 IPC |
| `modules/` | 实现 `AppModule` 接口的横向独立功能块，由 `ModuleRunner` 统一按序装配 | 依赖 `services/`、系统 API |

---

## 2. 核心架构铁律（AI / 开发者必须遵守）

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

---

## 3. AI 编码严禁清单 (Anti-Patterns)

- ❌ **禁止在 Controller 中写实质业务**（如操作数据库、复杂运算、读写文件），Controller 只做参数校验、调用与返回。
- ❌ **禁止裸传错误**：不得返回裸 Error 对象，必须映射为带 `ErrorCode` 的 `Result<never>`。
- ❌ **禁止私自创建桶文件（Barrel Files）**：严禁在 `services/`、`modules/` 随意建立 `index.ts` 做聚合 `export *`。
- ❌ **禁止反向依赖 Renderer**：主进程代码仅消费 `@app/shared`，绝不得包含任何对 `@app/renderer` 路径的引用。

---

## 4. 新增业务领域标准开发范式 (SOP)

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
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@app/shared/constants/ipc-channels';
import { createNoteInputSchema } from '@app/shared/schemas/notes';
import type { NoteItem } from '@app/shared/types/notes';
import type { Result } from '@app/shared/types/result';
import { notesService } from '../services/notes.service';
import { successResult, failResult, catchToResult } from './utils';
import { ErrorCode } from '@app/shared/constants/error-codes';

export function registerNotesControllers(): void {
  ipcMain.handle(
    IPC_CHANNELS.NOTES_CREATE,
    async (_event, rawInput: unknown): Promise<Result<NoteItem>> => {
      const parseResult = createNoteInputSchema.safeParse(rawInput);
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

### Step 3: 在 `controllers/index.ts` 登记挂载
```typescript
import { registerNotesControllers } from './notes.controller';

export function registerAllControllers(): void {
  // ...已有 controllers
  registerNotesControllers();
}
```

---

## 5. 跨包关联

- 契约源头：参见 [packages/shared/README.md](../shared/README.md)
- 安全桥接：参见 [packages/preload/README.md](../preload/README.md)
- 渲染层消费：参见 [packages/renderer/README.md](../renderer/README.md)
- 工程与提交规范：参见 [CONTRIBUTING.md](../../CONTRIBUTING.md)
- 返回根目录：[README.md](../../README.md)

