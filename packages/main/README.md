# @app/main 主进程架构规范与 AI 开发指南

主进程充当运行在 Node.js 环境下的**本地微型后端**，负责操作系统底层交互、窗口生命周期管理以及对渲染进程提供强契约的 IPC 接口。

---

## 1. 目录职责总览

```
packages/main/src/
├── index.ts              # 进程主入口：最早初始化 Sentry + ModuleRunner 流水线组装，initApp 失败降级记日志不闪退
├── ModuleRunner.ts       # 模块启动器：按序驱动各 AppModule 生命周期（本身是 PromiseLike，await 即等全链就绪）
├── AppModule.ts          # 模块接口定义：enable(context): Promise<void> | void
├── AppInitConfig.ts      # 进程装配输入（窗口条目、开发服务器地址等）
├── ModuleContext.ts      # 模块上下文（当前注入 app）
├── env.ts                # 环境门面：MODE 与运行时配置的权威读取点
├── lifecycle.ts          # 应用级生命周期判定（如末窗口关闭行为）
├── controllers/          # 通信接入层：IPC 路由监听、Zod 参数校验、异常包装（统一经 handleTraced 注册）
│   ├── index.ts          # registerAllControllers()：显式集中挂载所有 Controller
│   ├── utils.ts          # successResult / failResult / catchToResult 包装原语
│   └── <domain>.controller.ts
├── services/             # 业务规则层：Node/Electron 原生 API 调用与业务编排（单例模式）
│   └── <domain>.service.ts
├── telemetry/            # 全链路追踪：tracer（AsyncLocalStorage）、ipc-tracer（handleTraced）、window-tracer
├── modules/              # 系统切片层：窗口、托盘、日志、主题、IPC、单实例、安全等
│   ├── *.module.ts       # AppModule 生命周期单元：log / sentry / config / native-theme / ipc / startup-readiness / tray / single-instance / auto-terminate / hardware-acceleration
│   ├── window/           # 窗口注册表、标题栏 overlay、无边框重绘、窗口状态保持、更新窗口
│   ├── security/         # CSP、导航来源白名单、外链白名单
│   └── log-archiver.ts   # 日志归档与清理（纯函数，非生命周期模块）
└── errors/               # 领域异常定义（如 AppError）
```

| 目录/文件 | 核心职责 | 依赖方向（单向流动） |
| :--- | :--- | :--- |
| `controllers/` | 监听 IPC 请求，执行参数反序列化与校验，转发至 Service 并统一返回 `Result<T>` | 依赖 `services/`、`telemetry/`、`@app/shared` |
| `services/` | 实现业务规则与 Node.js / Electron 原生 API 调用，禁止感知 IPC 协议细节 | **严禁**依赖 `controllers/`；不得引入 `ipcMain` / `IpcMainInvokeEvent` |
| `modules/` | 横向独立功能块：`*.module.ts` 实现 `AppModule` 由 `ModuleRunner` 装配，其余为无生命周期 helper（窗口注册表 / 状态保持 / 日志归档） | 依赖 `services/`、`telemetry/`、系统 API；`ipc.module.ts` 负责触发 controllers 注册 |

---

## 2. 核心架构铁律（AI / 开发者必须遵守）

1. **单向调用禁止逆流**：
   - 依赖链路严格限制为：`IPC 事件 ➔ Controller ➔ Service`。
   - **Service 严禁感知 IPC**：Service 方法签名必须是纯数据输入和纯返回，不得引入 `ipcMain`、`IpcMainInvokeEvent`；确需主→渲染推送时（如 updater 下载进度），统一经 `modules/window/window-registry` 的 `sendToWindow` 出口，不在 Service 内直接持有 `webContents`。
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
- ❌ **禁止业务层反向依赖 Renderer**：Service 与 Controller 纯业务层严禁感知或引用 Renderer 的代码与组件；仅 `index.ts` 进程装配阶段通过 `require.resolve('@app/renderer')` 获取生产静态 HTML 产物物理路径。
- ❌ **禁止遗漏 C++ 原生模块 external 对齐**：主进程声明的生产依赖（如 `usb`, `electron-log`, `electron-updater`）必须 100% 在 `packages/main/vite.config.ts` 的 `rolldownOptions.external` 中排除，受 `pnpm run verify:deps` 自动化门禁保护。注意 `@sentry/electron` 是 devDependency，经 `ssr.noExternal` 主动内联打包，不在 external 之列，不构成违例。

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
import { ErrorCode } from '@app/shared/constants/error-codes';
import { IPC_CHANNELS } from '@app/shared/constants/ipc-channels';
import { createNoteInputSchema } from '@app/shared/schemas/notes';
import type { NoteItem } from '@app/shared/types/notes';
import type { Result } from '@app/shared/types/result';
import { handleTraced } from '../telemetry/ipc-tracer';
import { notesService } from '../services/notes.service';
import { successResult, failResult, catchToResult } from './utils';

export function registerNotesControllers(): void {
  handleTraced(
    IPC_CHANNELS.NOTES_CREATE,
    async (_event, input: unknown): Promise<Result<NoteItem>> => {
      const parseResult = createNoteInputSchema.safeParse(input ?? {});
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

> **必须走 `handleTraced`，严禁裸写 `ipcMain.handle`**：`handleTraced` 负责解包 preload 传入的 `__trace_carrier`、创建 `ipc.receive:<channel>` span，并把返回的 `Result` 成败记录为 span 属性（`app.result_success` / `business_error`）。裸 `ipcMain.handle` 会静默丢失全链路追踪并与 preload 的 payload 包装约定不兼容。handler 第二形参是解包后的数据（故示例用 `input` 而非 `rawInput`）。

### Step 3: 在 `controllers/index.ts` 登记挂载
```typescript
import { registerNotesControllers } from './notes.controller';

export function registerAllControllers(): void {
  // ...已有 controllers
  registerNotesControllers();
}
```

---

## 5. 横切关注点与提交前门禁

ModuleRunner 的链位顺序即优先级（见 `index.ts` 注册表）：日志 → Sentry → 配置 → 主题 → IPC → 启动就绪 → 窗口 → 更新窗口 → 托盘 → 单实例 → 安全模块。启动就绪源刻意先于窗口壳，保证首屏揭幕时主进程信号已到位。

- **全链路追踪**：所有 IPC 经 `handleTraced` 创建 span，W3C traceparent 由 preload 跨进程传入，日志自动注入 `[trace_id:... span_id:...]`，span 结束以 NDJSON 落盘 `traces.ndjson`
- **日志与崩溃**：`electron-log` 5MB 滚动归档；未捕获异常经 `errorHandler.startCatching` 落盘且不弹崩溃框；Sentry 采集主进程异常与渲染进程崩溃/未响应，隐私最小化（零 Breadcrumbs、零 Tracing 采样）
- **窗口与桌面集成**：WCO 标题栏（win32 `frame:false` + overlay 选项，mac 传 `true`，linux 保持系统边框）、单实例锁、托盘常驻、窗口状态保持与多显示器越界矫正
- **提交前必跑门禁**：`pnpm typecheck`、`pnpm lint`、`pnpm test`——与 CI 四 Job（typecheck / lint / test / e2e）同款检查，本地先过再推送

---

## 6. 跨包关联

- 契约源头：参见 [packages/shared/README.md](../shared/README.md)
- 安全桥接：参见 [packages/preload/README.md](../preload/README.md)
- 渲染层消费：参见 [packages/renderer/README.md](../renderer/README.md)
- 工程与提交规范：参见 [CONTRIBUTING.md](../../CONTRIBUTING.md)
- 返回根目录：[README.md](../../README.md)

