---
title: 全链路追踪（W3C-trace）
description: W3C traceparent 从 Preload 穿透主进程，AsyncLocalStorage 维持上下文。
---

# 全链路追踪（W3C-trace）

> **TL;DR**：业务 IPC 自动携带轻量 W3C `traceparent` 上下文；主进程借助 `AsyncLocalStorage` 维持调用链路，日志自动挂载 `[trace_id:...]`，返回结果回注 `traceId`，无需引入繁重的外部 APM SDK。

## 1. 选型理由

桌面跨进程调用排障经常陷入困境：
- 用户报告“点击按钮报错”，开发者在前端看到 UI 报错，却无法从主进程成千上万行日志中找到是哪一次 IPC 失败引发的。
- 传统的 OpenTelemetry / SkyWalking 等 SDK 体积极大，重度依赖 Node 原生动态 Hook，在打包进 Electron ASAR 时极易产生兼容性灾难。

工程采用纯函数实现的 W3C Trace Context 规范，零外部 SDK 实现跨端穿透。

## 2. 核心配置代码

### Preload 自动注入 Trace Carrier

所有业务 IPC 请求自动生成 W3C 标准上下文并作为不可见元数据随载荷下发：

→ 源码：[packages/preload/src/telemetry/ipc-tracer.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/preload/src/telemetry/ipc-tracer.ts)

```ts
export async function invokeTraced<R = unknown, T = unknown>(channel: string, data?: T): Promise<R> {
  const traceparent = serializeTraceParent({
    traceId: generateTraceId(),
    spanId: generateSpanId(),
    traceFlags: '01',
  });

  const payload: TracedIpcPayload<T | undefined> = {
    __trace_carrier: { traceparent },
    data,
  };

  return ipcRenderer.invoke(channel, payload);
}
```

### 主进程 handleTraced 解包与 AsyncLocalStorage 续接

主进程解包上游上下文，并利用 Node 官方 `AsyncLocalStorage` 隐式向下游深层函数传递：

→ 源码：[packages/main/src/telemetry/tracer.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/telemetry/tracer.ts)

```ts
// 利用 AsyncLocalStorage 让 handler 内部的任意异步调用自动感知当前 Span
private readonly storage = new AsyncLocalStorage<SpanContext>();

return this.storage.run(manualSpan.context, async () => {
  try {
    const result = await fn(span);
    manualSpan.end('OK');
    return result;
  } catch (err) {
    manualSpan.recordException(err);
    manualSpan.end('ERROR');
    throw err;
  }
});
```

### 三大出口闭环消费

1. **主进程日志前缀**：活跃上下文存在时，`main.log` 每行日志自动前缀 `[trace_id:xxxx span_id:yyyy]`。
2. **遥测落盘**：Span 结束时以 NDJSON 格式增量写入 `traces.ndjson`，支持毫秒级拓扑还原。
3. **结果回注**：业务返回 `Result<T>` 自动注入该 `traceId`，渲染层报错时直接打印该 ID。

## 3. 桌面端避坑注意事项

- **日志管道本身严禁套用 traceparent**：
  - 日志传输通道 `IPC_CHANNELS.DIAGNOSTICS_LOG` 是唯一必须绕过 `handleTraced` 的特例。若日志管道自身也生成 Span 并打日志，将引发无休止的“日志生成遥测、遥测触发日志”的死循环自噪。
- **高频成功轮询可关闭成功 Span 写入**：
  - 对于心跳检测或秒级状态拉取，可在选项中配置 `recordSuccess: false`，仅在发生异常时才将 Span 写入 `traces.ndjson`，避免拓扑文件快速膨胀。
- **跨进程排障黄金链路**：
  - 前端报错 ➔ 提取错误对象中的 `traceId` ➔ 在 `main.log` 全文检索该 ID ➔ 立即对齐主进程错误堆栈。
