---
title: 日志与链路排查（Usage）
description: 从诊断面板打开日志目录，用 traceId 把渲染层与主进程的日志串成一条链路。
---

# 日志与链路排查（Usage）

> **TL;DR**：从诊断面板打开日志目录，用 traceId 把渲染层与主进程的日志串成一条链路。

排障时最怕的不是没有日志，而是渲染层、主进程各写各的，出事以后对不上号。这一页只讲用法：一次操作留下哪些痕迹、出了问题按什么顺序把两端日志串起来。落盘与追踪的实现机制分别见 [本地日志（Electron-log）](/main/logging) 与 [全链路追踪（W3C-trace）](/main/tracing)。

## 要解决的坑

- 渲染进程的 `console` 只活在 DevTools 里，窗口一关、打包版一出，现场就没了
- 一次失败往往跨渲染与主进程，两边日志各写各的文件，只能靠时间戳猜关联
- 日志目录随系统而变，排障时先花时间找文件，而不是看问题

## 本仓库的解法

### 1. 渲染层日志：统一用 `logger`，落到 `renderer-<窗口名>.log`

→ 源码：[packages/preload/src/logger.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/preload/src/logger.ts) · [packages/renderer/src/env.d.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/env.d.ts)

业务日志统一走全局 `logger`（即 `window.logger`，类型声明在 `env.d.ts`）：

```ts
logger.info('Document started', { entry: 'home' });
```

同一条日志有两个去处：DevTools 里能立刻看到回显，磁盘上落进当前窗口的 `renderer-home.log` / `renderer-updater.log`，每行以时间、级别开头，正文带 `[Renderer] [窗口名]` 前缀。`debug` 只在开发态出现，打包版排障看 `info` / `warn` / `error`。双写与 IPC 落盘怎么实现见 [本地日志（Electron-log）](/main/logging)。

### 2. traceId：一次 IPC 调用两端共用同一个 ID

→ 源码：[packages/renderer/src/lib/ipc.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/lib/ipc.ts) · [packages/main/src/telemetry/tracer.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/telemetry/tracer.ts)

业务 IPC 返回的 `Result` 会带 `traceId`；失败时 `callIpc` 把它保留在 `IpcError.traceId`，日志里用 `logger.withTrace(traceId)` 带上：

```ts
const targetLogger =
  traceId && typeof logger.withTrace === 'function' ? logger.withTrace(traceId) : logger;
```

于是渲染日志行出现 `[trace_id:...]`，主进程同一条链路写下的日志行带同一个 `[trace_id:... span_id:...]`。排障时拿渲染日志里的 trace_id 去 `main.log` 搜，就能对上主进程侧同一段处理与失败日志。trace 怎么生成、怎么跨进程传播，见 [全链路追踪（W3C-trace）](/main/tracing)。

### 3. 诊断面板：打开目录，认清三个文件

→ 源码：[packages/renderer/src/features/logging/hooks/useLogging.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/features/logging/hooks/useLogging.ts) · [packages/main/src/modules/log.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/log.module.ts)

首页 Dashboard 的「生产分级日志 (LogManager)」卡片就是排障入口：

- **打开日志目录**：经 `diagnostics.openLogFolder` 让主进程用 `shell.openPath` 打开 electron-log 的日志目录，并把实际路径回显在卡片上
- **发送 INFO / WARN / ERROR**：从渲染层各写一行测试日志到 `renderer-home.log`，先验证落盘链路是通的
- **触发 Sentry 异常 / 触发 ErrorBoundary 崩溃**：制造一次真实错误，检查错误日志与上报链路

日志目录取自主日志文件所在目录，不写死平台路径。打开后认这三个文件：

| 文件 | 内容 |
| --- | --- |
| `main.log` | 主进程日志，含 `[App Lifecycle]` 启动分隔行与 IPC 失败行 |
| `renderer-<窗口名>.log` | 渲染层按窗口分文件（`renderer-home.log` / `renderer-updater.log`），含 `[Window Lifecycle]` 窗口分隔行 |
| `traces.ndjson` | 每个 span 一行 NDJSON，按 `trace_id` 关联调用拓扑 |

### 4. 一次排障的推荐顺序

1. 打开诊断面板 →「打开日志目录」
2. 在 `renderer-<窗口名>.log` 里按时间与关键词定位失败行；行内带 `[trace_id:...]` 就记下来
3. 用同一个 trace_id 搜 `main.log`，对照主进程侧的 IPC 失败与异常行
4. 需要完整调用拓扑时，在 `traces.ndjson` 里按 trace_id 查 span（字段见 [全链路追踪（W3C-trace）](/main/tracing)）
5. 开发态还可以直接看 DevTools 里的同一条回显；打包版排障则以落盘文件为准

## 怎么抄

- 渲染层统一用 `logger`，不要裸 `console.log`：后者只留在 DevTools，打包版排障时等于没有
- 失败路径把 `callIpc` 抛出的 `IpcError.traceId` 带进日志（`logger.withTrace(traceId)`，或在最后一个参数附 `{ __trace_id: traceId }`），否则两端日志对不上
- 诊断入口保留「打开日志目录」和「发送测试日志」两个动作，排障第一步不用记路径
- 多窗口按窗口名分文件，不要让所有窗口挤进同一个文件
- 日志突然变少，先在 `main.log` 搜 `Dropped N renderer log line(s)`；渲染日志的超长行会带 `[truncated N chars]` 标记，不是日志丢了（阈值见 [本地日志（Electron-log）](/main/logging)）
