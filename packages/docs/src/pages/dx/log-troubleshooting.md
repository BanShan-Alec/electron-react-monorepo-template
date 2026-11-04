---

title: 日志与链路排查（Usage）
description: 诊断面板一键唤起日志目录，利用 W3C traceId 串联跨端日志排障实践。
---

# 日志与链路排查（Usage）

> **TL;DR**：渲染端禁止裸写 `console.log`，统一调用 `logger` 双写落盘；一次 IPC 交互跨越主进程与渲染进程，以统一的 `traceId` 串起调用拓扑，通过内置诊断面板可一键定位日志文件。

## 1. 选型理由

桌面端排查故障面临天然的跨进程壁垒：
1. **控制台不留痕**：安装包在普通用户电脑上运行，无 DevTools 窗口，原生 `console.log` 随着进程销毁荡然无存。
2. **时序割裂无关联**：渲染端发生按钮超时，主进程发生底座异常，两端日志各自独立切分文件，无法在大量日志中精确定位同一次操作。

工程通过分级日志引擎（electron-log）与 W3C Trace 链路上下文追踪，打通双端排错通道。

## 2. 排查核心操作与文件清单

### 认清三类核心日志文件

在 Dashboard 的「日志管理 (LogManager)」卡片点击「打开日志目录」，系统资源管理器将自动展开对应平台的应用数据夹：

| 文件名                    | 记录内容与排错重点                                                                     |
| :------------------------ | :------------------------------------------------------------------------------------- |
| **`main.log`**            | 主进程日志，包含应用生命周期、未捕获异常、IPC 处理报错与系统级事件                     |
| **`renderer-<窗口>.log`** | 渲染层日志（按窗口隔离，如 `renderer-home.log`），包含 UI 操作、状态异常与前端网络错误 |
| **`traces.ndjson`**       | W3C 规范的调用拓扑，每行记录一个 Span，通过 `trace_id` 将跨进程调用串联成树            |

### 跨进程 traceId 穿透排障

渲染进程发起 IPC 请求失败时，统一捕获携带 `traceId` 的 `IpcError` 并打入日志：

→ 源码：[packages/renderer/src/lib/ipc.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/lib/ipc.ts)

```ts
// 渲染端记录日志时自动挂载 traceId
const targetLogger = traceId ? logger.withTrace(traceId) : logger;
targetLogger.error('业务调用失败', { error: err.message });
```

排障四步走：
1. 打开 `renderer-home.log`，定位报错行，提取方括号内的 `[trace_id:xxxx]`；
2. 打开 `main.log`，全文搜索该 `trace_id`，立即找到主进程对应该请求的执行堆栈；
3. 若需排查执行耗时瓶颈，前往 `traces.ndjson` 过滤该 `trace_id` 查看每个 Span 的毫秒级耗时。

## 3. 桌面端避坑注意事项

- **杜绝裸写 `console.log`**：
  - 生产打包后 `console.log` 只在调试工具中一闪而过，排查线上 Bug 等同盲打。必须统一使用 Preload 暴露的 `window.logger.info()`、`logger.error()`。
- **高频日志背压与限流保护**：
  - 若在主进程 `main.log` 中检索到 `Dropped N renderer log line(s)`，代表渲染进程在极短时间内产生了海量刷屏日志被 IPC 背压队列主动丢弃，请排查组件是否存在死循环触发日志。
- **跨平台路径兼容**：
  - 严禁在代码中写死 `%APPDATA%` 或 `~/Library`，日志目录路径统一由主进程 `app.getPath('userData')` 获取，通过系统安全 API `shell.openPath(dir)` 唤起。
