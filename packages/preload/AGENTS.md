# @app/preload AGENTS.md — 安全桥接层规则（AI 必读）

> 人类向概览见 [README.md](./README.md)；全局红线与全仓任务路由见 [根 AGENTS.md](../../AGENTS.md)。
> 本文件是该包规则的唯一真源：README 不再承载目录结构与编写规则。

## 1. 目录结构（packages/preload/src/）

```
packages/preload/src/
├── index.ts              # 聚合实现并暴露 apiBridge（contextBridge.exposeInMainWorld）
├── logger.ts             # 渲染进程全局 logger 桥：调用经 invokeTraced 转发至主进程落盘
└── telemetry/
    └── ipc-tracer.ts     # invokeTraced：生成 W3C traceparent 并以 __trace_carrier 跨进程透传
```

构建方式：vite lib 模式输出 CJS（`dist/index.cjs`），electron 外置、`@sentry/electron`（devDependency）经 `ssr.noExternal` 内联；产物由主进程以 preload 路径挂载到窗口。

## 2. 编写规则（铁律）

1. **类型强绑定**：`apiBridge` 必须显式声明类型为 `ElectronApi`：
   ```typescript
   import type { ElectronApi } from '@app/shared/types/api';
   export const apiBridge: ElectronApi = { ... };
   ```
2. **通道常量消费**：`ipcRenderer.invoke` 的 Channel 必须统一从 `@app/shared/constants/ipc-channels` 引入，严禁硬编码通道字符串。
3. **必须经 invokeTraced 透传追踪**：所有 invoke 必须经 `telemetry/ipc-tracer` 的 `invokeTraced` 包装以携带 traceparent，禁止直接调用 `ipcRenderer.invoke`。
4. **零业务逻辑**：Preload 仅作"透明请求转发"，不得在 Preload 内部做数据持久化、复杂运算或状态缓存。
5. **安全沙箱隔离**：在 `contextIsolation: true` 与 `sandbox: true` 约束下，严禁向渲染进程泄露任何 Node.js 原生模块（如 `fs`、`child_process`、`electron` 原始对象）。`ElectronApi` 上的 `invokeTraced` 为泛型追踪调用预留，新增直接消费方前需评估契约逃逸风险。
