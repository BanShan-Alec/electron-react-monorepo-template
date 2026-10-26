# 全链路追踪（W3C trace）

> **TL;DR**：W3C traceparent 从 preload 贯穿主进程，日志前缀、`traces.ndjson` 与 `Result.traceId` 三个出口串起两端。

## 要解决的坑

用户报障只有一句「点了一下就崩了」——渲染层的操作在主进程日志里找不到痕迹，两边日志各记各的串不起来。

## 本仓库的解法

→ 源码：[packages/preload/src/telemetry/ipc-tracer.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/preload/src/telemetry/ipc-tracer.ts)

所有经 apiBridge 白名单的业务 IPC 调用自动携带 W3C traceparent（唯一绕过者是日志桥的 `DIAGNOSTICS_LOG` 直调，见[第 8 节](/main/logging)）：

```ts
export async function invokeTraced<R = unknown, T = unknown>(
  channel: string,
  data?: T,
): Promise<R> {
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  const traceparent = serializeTraceParent({
    traceId,
    spanId,
    traceFlags: '01',
  });

  const payload: TracedIpcPayload<T | undefined> = {
    __trace_carrier: {
      traceparent,
    },
    data,
  };

  return ipcRenderer.invoke(channel, payload);
}
```

主进程侧统一在 `handleTraced` 里解包 carrier、续开 span——渲染层的操作从此在主进程有了锚点：

→ 源码：[packages/main/src/telemetry/ipc-tracer.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/telemetry/ipc-tracer.ts)

```ts
if (isTracedIpcPayload<T>(rawInput)) {
  data = rawInput.data;
  if (rawInput.__trace_carrier) {
    parentContext = tracer.extract(
      rawInput.__trace_carrier as Record<string, string | undefined>,
    );
  }
} else {
  // 兼容非包装调用的降级处理
  data = rawInput as T;
}

return tracer.startActiveSpan(
  `ipc.receive:${channel}`,
  {
    parentContext,
    attributes: {
      'ipc.channel': channel,
      'rpc.system': 'electron-ipc',
      ...(windowId !== undefined ? { 'window.id': windowId } : {}),
      ...(windowName ? { 'window.name': windowName } : {}),
    },
  },
  async (span) => {
    // ...业务 handler 执行、异常记录、耗时统计
  },
);
```

span 实现的核心是 `AsyncLocalStorage`——handler 内部任何深度再开子 span，traceId 自动续上，不用手动传上下文：

→ 源码：[packages/main/src/telemetry/tracer.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/telemetry/tracer.ts)

```ts
private readonly storage = new AsyncLocalStorage<SpanContext>();
// ...
return this.storage.run(manualSpan.context, async () => {
  try {
    const result = await fn(manualSpan);
    manualSpan.end('OK');
    return result;
  } catch (err) {
    manualSpan.recordException(err);
    manualSpan.end('ERROR');
    throw err;
  }
});
```

三个出口让 trace 真正可消费：

- **每条主进程日志自动带前缀**——LogManager 注册 hook，活跃上下文存在时给日志行加 `[trace_id:xxx span_id:yyy]`（见[第 8 节](/main/logging)），拿一个 traceId 就能在 main.log 里 grep 出整条链路
- **span 落盘 traces.ndjson**——LogManager 监听 `onSpanEnd`，把 SpanRecord 以 NDJSON 逐行写入独立文件
- **traceId 回注渲染层**——业务返回 `Result` 结构时注入 `traceId`：

```ts
const enrichedResult = {
  ...res,
  traceId: span.context.traceId,
};
```

渲染层报障时把这个 ID 发过来，两端日志一串就齐。traceparent 的生成/解析是 shared 里的纯函数（→ 源码：[packages/shared/src/utils/w3c-trace-context.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/utils/w3c-trace-context.ts)），不依赖任何 OpenTelemetry SDK。

## 怎么抄

- **主进程交互**：走 [contracts.md](/security/ipc-contract) 的四步流程；经 `handleTraced` 注册的 IPC 自动获得 span、日志 trace 前缀与 `Result.traceId`，可观测性免费带
- 跨端串线索用 traceId 或直接看 `traces.ndjson`

注意点：

- 日志管道 `DIAGNOSTICS_LOG` 是唯一绕过 `handleTraced` 注册的通道（避免每行日志生成 span 的遥测自噪），其余业务 IPC 必须经 `handleTraced`
