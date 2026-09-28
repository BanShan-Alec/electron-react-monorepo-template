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
    │   ├── error-codes.ts   # 统一语义化错误码 (SCREAMING_SNAKE_CASE)
    │   └── ipc-channels.ts  # IPC 通信通道常量定义
    │
    ├── types/               # 纯 TypeScript 接口定义（零运行时体积）
    │   ├── result.ts        # 全栈通用 Result<T> 响应包装器
    │   ├── api.ts           # Window.api (ElectronApi) 跨端调用契约
    │   ├── system.ts        # 系统与硬件信息返回接口
    │   ├── counter.ts       # 计数器领域返回接口
    │   ├── calculator.ts    # 计算器领域返回接口
    │   ├── diagnostics.ts   # 诊断与行为返回接口
    │   └── dialog.ts        # 原生对话框返回接口
    │
    └── schemas/             # Zod 运行时数据校验模型及派生输入类型
        ├── counter.ts       # 计数器输入 Schema 与 StepInput
        ├── calculator.ts    # 计算器入参 Schema 与 CalculateInput
        ├── config.ts        # 应用配置 Schema、类型及默认值 DEFAULT_CONFIG
        ├── diagnostics.ts   # 日志与操作入参 Schema 及推导类型
        ├── dialog.ts        # 原生文件/目录对话框配置入参 Schema
        └── shell.ts         # Shell 唤起入参 Schema 及类型
```

---

## 2. 核心设计原则

### 2.1 Schema 与推导类型就近原则
- **输入参数校验规则必须由 Zod 驱动**，禁止手写重复的 TypeScript 类型。
- 凡是由 `z.infer<typeof schema>` 推导出的类型，**必须且仅允许**在其对应的 `schemas/*.ts` 文件内定义并导出。
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
    "./types/*": "./src/types/*.ts"
  }
  ```
- 消费端（`main`、`preload`、`renderer`）按需直达具体文件。主进程与 preload 为 CJS 出包、无 tree-shaking，根入口会把整张契约图（含 schemas→zod）拖进 require 链，故取消根桶：
  ```ts
  import { ErrorCode } from '@app/shared/constants/error-codes';
  import { calculateInputSchema } from '@app/shared/schemas/calculator';
  import type { CalculateResult } from '@app/shared/types/calculator';
  ```
- **严禁桶文件**：不得新增任何 `index.ts` 聚合导出，不得使用 `export *`（由 Biome `performance.noBarrelFile` / `noReExportAll` 强制）。确需引入桶文件的唯一合法流程见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

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

