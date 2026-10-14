# @app/shared 架构分层规范与开发指南

`@app/shared` 是全栈跨端通信契约的**单一事实源 (Single Source of Truth)**，负责在 Electron 的主进程 (`main`)、预加载脚本 (`preload`) 以及渲染进程 (`renderer`) 之间共享数据结构、校验模型与通信通道。

---

## 1. 目录架构

代码按**技术职能水平分层**，业务领域在各层内进行垂直切分，文件命名统一采用 `kebab-case`：

```
packages/shared/
├── README.md                # 架构规范与开发守则文档
├── package.json             # exports 子路径映射（无根入口，无桶文件）
├── tsconfig.json
└── src/
    ├── constants/           # 系统级常量与枚举
    │   ├── env.ts           # 统一运行环境常量 (APP_ENV)
    │   ├── error-codes.ts   # 统一语义化错误码 (SCREAMING_SNAKE_CASE)
    │   ├── ipc-channels.ts  # IPC 通信通道常量定义
    │   ├── startup.ts       # 启动就绪与协调器契约常量
    │   └── windows.ts       # 窗口 ID 常量定义
    │
    ├── types/               # 纯 TypeScript 接口定义（零运行时体积）
    │   ├── env.ts           # 运行环境契约类型与标志位 (AppEnv, EnvFlags)
    │   ├── result.ts        # 全栈通用 Result<T> 响应包装器
    │   ├── api.ts           # Window.api (ElectronApi) 跨端调用契约
    │   ├── system.ts        # 系统与硬件信息返回接口
    │   ├── usb.ts           # 原生 USB 硬件设备信息返回接口
    │   ├── counter.ts       # 计数器领域返回接口
    │   ├── calculator.ts    # 计算器领域返回接口
    │   ├── diagnostics.ts   # 诊断与行为返回接口
    │   ├── dialog.ts        # 原生对话框返回接口
    │   ├── startup.ts       # 启动就绪快照与主进程就绪载荷
    │   ├── telemetry.ts     # 追踪契约（SpanContext / TraceCarrier / TracedIpcPayload）
    │   └── updater.ts       # 自动更新状态、进度与发布信息
    │
    ├── schemas/             # Zod 运行时数据校验模型及派生输入类型
    │   ├── counter.ts       # 计数器输入 Schema 与 StepInput
    │   ├── calculator.ts    # 计算器入参 Schema 与 CalculateInput
    │   ├── config.ts        # 应用配置 Schema、类型及默认值 DEFAULT_CONFIG
    │   ├── diagnostics.ts   # 日志与操作入参 Schema 及推导类型
    │   ├── dialog.ts        # 原生文件/目录对话框配置入参 Schema
    │   ├── shell.ts         # Shell 唤起入参 Schema 及类型
    │   └── updater.ts       # 更新状态/进度/快照 Schema 及推导类型
    │
    └── utils/               # 跨端纯函数工具（零 Electron 依赖）
        ├── env-packer.ts    # 运行时环境编解码（XOR 掩码 + Base64URL，--app-meta= 参数）
        └── w3c-trace-context.ts # W3C traceparent 生成 / 解析 / 序列化
```

---

## 2. 核心设计原则

### 2.1 Schema 与推导类型就近原则
- **输入参数校验规则必须由 Zod 驱动**，禁止手写重复的 TypeScript 类型。
- 凡是由 `z.infer<typeof schema>` 推导出的类型，默认在其对应的 `schemas/*.ts` 文件内定义并导出；跨端事件负载类类型（如 `updater` 的状态 / 进度 / 快照）经评审后可例外地在 `types/` 内派生，避免 schemas 与 types 双向缠绕。
- 确保“运行时入参校验逻辑”与“编译期类型安全”拥有唯一的源头。

### 2.2 纯返回接口归入 `types/`
- 仅作为主进程返回给渲染端的结构体（如 `PingResult`、`CalculateResult`、`FileDialogResult`），因无需在 IPC 入口执行逆向运行时反序列化校验，作为纯 TypeScript `interface` 或 `type` 归入 `types/` 对应领域文件中。
- 顶层通用抽象（如 `Result<T>` 契约模型与 `ElectronApi` 全局桥接对象接口）维护在 `types/result.ts` 与 `types/api.ts`。

### 2.3 常量职责切分
- **系统级/跨域常量**（如 `ErrorCode`、`IPC_CHANNELS`）：维护在 `constants/` 目录下。
- **领域特定默认值**（如 `DEFAULT_CONFIG`）：与领域 Schema 强相关，就近维护在对应的 `schemas/*.ts` 文件内。

### 2.4 子路径直出与桶文件禁令
- 内部物理拆分，**不设顶层统一入口**：`package.json` 通过子路径 `exports` 直出具体文件：
  ```json
  "exports": {
    "./constants/*": "./src/constants/*.ts",
    "./schemas/*": "./src/schemas/*.ts",
    "./types/*": "./src/types/*.ts",
    "./utils/*": "./src/utils/*.ts"
  }
  ```
- 消费端（`main`、`preload`、`renderer`）按需直达具体文件。主进程与 preload 为 CJS 出包、无 tree-shaking，根入口会把整张契约图（含 schemas→zod）拖进 require 链，故取消根桶：
  ```ts
  import { ErrorCode } from '@app/shared/constants/error-codes';
  import { calculateInputSchema } from '@app/shared/schemas/calculator';
  import type { CalculateResult } from '@app/shared/types/calculator';
  ```
- **严禁桶文件**：不得新增任何 `index.ts` 聚合导出，不得使用 `export *`（由 Biome `performance.noBarrelFile` / `noReExportAll` 强制）。确需引入桶文件的唯一合法流程见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

### 2.5 运行环境事实标准与跨端门面契约
- **单一事实源**：在 `constants/env.ts` 与 `types/env.ts` 中定义 `APP_ENV`（`'development' | 'production' | 'test'`）与 `AppEnv` 类型。
- **门面消费**：主进程 (`packages/main/src/env.ts`) 提供权威读取门面，渲染进程通过 `window.__APP_ENV__` 同步消费；运行环境以 `MODE` 变量为唯一驱动源，业务代码原则上不得直接读取原生 `process.env.*`（已知例外：`sentry.module.ts` 初始化处的 `SENTRY_DSN` / `MODE` 直读）。
- **跨端传递**：运行时环境由 `utils/env-packer.ts` 编解码，主进程经 `additionalArguments` 注入、preload 解包冻结后暴露，改配置不触发重新编译。

### 2.6 跨端能力契约速览

- **`utils/` 零依赖纯函数**：`env-packer`（`packRuntimeEnv` / `unpackRuntimeEnv`）负责运行环境在 `--app-meta=` 参数中的编解码；`w3c-trace-context`（`generateTraceId` / `serializeTraceParent` / `parseTraceParent` 等）是全链路追踪的 W3C 信封实现，被 main 与 preload 共同消费。
- **`updater` 全领域契约**：`schemas/updater.ts` 提供状态 / 进度 / 快照的 zod 模型，`types/updater.ts` 提供派生类型，`IPC_CHANNELS` 中的 `UPDATER_*` 通道覆盖检查、进度、完成与事件广播。
- **`startup` 就绪契约**：`constants/startup.ts` 定义 `APP_STARTUP_READY_CLASS` 等 DOM 事件 / 键名常量，`types/startup.ts` 定义就绪快照与主进程载荷，支撑首屏启动壳的“先拉后推”信号桥。
- **`telemetry` 追踪契约**：`types/telemetry.ts` 定义 `SpanContext` / `SpanRecord` / `TraceCarrier` / `TracedIpcPayload`，是 traceparent 跨进程传播与 span 落盘的数据结构基准。
- **`ElectronApi` 特殊成员**：除领域方法外还包含 `getPathForFile`（文件路径安全桥）与 `invokeTraced`（泛型追踪调用），两者均非 `Result<T>` 形态，渲染层直接消费。

---

## 3. 命名规范与风格

| 类别 | 规范 | 示例 |
| :--- | :--- | :--- |
| **文件名** | `kebab-case.ts` | `error-codes.ts`, `ipc-channels.ts` |
| **常量与枚举** | `SCREAMING_SNAKE_CASE` | `IPC_CHANNELS.CALCULATOR_CALCULATE`, `ErrorCode.VALIDATION_ERROR` |
| **Zod Schema** | `camelCase` + 后缀 `Schema` | `calculateInputSchema`, `stepInputSchema` |
| **TypeScript 类型/接口** | `PascalCase` | `Result<T>`, `CalculateInput`, `CalculateResult`, `ElectronApi` |

---

## 4. 新增业务领域开发范式 (SOP)

当在主进程和渲染端新增功能（以新增 `notes` 领域为例）时，请严格遵照以下步骤：

### 步骤 1：定义运行时校验 Schema 与入参类型
在 `src/schemas/notes.ts` 中创建：
```ts
import { z } from 'zod';

export const createNoteInputSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(100),
  content: z.string().default(''),
});

export type CreateNoteInput = z.infer<typeof createNoteInputSchema>;
```
无需在任何聚合文件中登记；消费方直接从 `@app/shared/schemas/notes` 导入。

### 步骤 2：定义纯返回接口（如有）
在 `src/types/notes.ts` 中创建：
```ts
export interface NoteItem {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}
```
同样无需登记；消费方直接从 `@app/shared/types/notes` 导入。

### 步骤 3：注册 IPC 通道
在 `src/constants/ipc-channels.ts` 中追加：
```ts
export const IPC_CHANNELS = {
  // ... 其他通道
  NOTES_CREATE: 'notes:create',
  NOTES_LIST: 'notes:list',
} as const;
```

### 步骤 4：扩充全局 Bridge API 契约
在 `src/types/api.ts` 中引入对应类型并扩充 `ElectronApi`：
```ts
export interface ElectronApi {
  // ... 其他领域
  notes: {
    create: (input: CreateNoteInput) => Promise<Result<NoteItem>>;
    list: () => Promise<Result<NoteItem[]>>;
  };
}
```

完成上述步骤后，主进程 Controller 可直接使用 `createNoteInputSchema.safeParse` 进行强校验，Preload 即可对齐 `apiBridge` 实现，Renderer 即可获得强类型自动补全与类型检查。

---

## 5. 跨包关联与后续开发

- **主进程实现**：在 [packages/main/README.md](../main/README.md) 中实现 Service 与 Controller 并挂载
- **Preload 桥接**：在 [packages/preload/README.md](../preload/README.md) 中将 API 挂载至 `apiBridge`
- **渲染层消费**：在 [packages/renderer/README.md](../renderer/README.md) 中通过 `useIpc` 消费
- **全局工程规范**：参见 [CONTRIBUTING.md](../../CONTRIBUTING.md)
- **返回根目录**：[README.md](../../README.md)

