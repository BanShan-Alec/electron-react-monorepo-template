# 本地日志（Electron-log）

> **TL;DR**：主进程、每个渲染窗口、遥测拓扑分文件落盘并独立轮转，作用域前缀与渲染层日志桥双写。

## 要解决的坑

日志只活在 DevTools 里，用户机器上出了问题无从查起。

## 本仓库的解法

→ 源码：[packages/main/src/modules/log.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/log.module.ts)

主日志按文件拆分：主进程 `main.log`、每个渲染窗口独立 `renderer-<window>.log`、遥测拓扑独立 `traces.ndjson`，各自独立轮转：

```ts
// 主进程日志配置
this.mainLogger.transports.file.fileName = 'main.log';
this.mainLogger.transports.file.maxSize = MAX_SIZE;
this.mainLogger.transports.file.archiveLogFn = createCustomArchiveLogFn();

// 遥测拓扑日志配置 (NDJSON 独立文件)
this.traceLogger.transports.file.fileName = 'traces.ndjson';
this.traceLogger.transports.file.maxSize = TRACE_MAX_SIZE;
this.traceLogger.transports.file.format = '{text}';

// 捕获未捕获异常并落盘
this.mainLogger.errorHandler.startCatching({
  showDialog: false,
  onError: ({ error }) => {
    this.mainLogger.error('[Uncaught Exception]', error);
  },
});
```

单文件超过上限（主日志 5MB / 遥测 10MB，见 [packages/main/src/constants/logging.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/constants/logging.ts)）自动归档，归档文件按保留策略清理：最多 7 天、每类最多 5 份（→ 源码：[packages/main/src/modules/log-archiver.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/log-archiver.ts)）。

业务代码不直接摸 log 实例，用作用域 Logger 自动带 `[模块名]` 前缀：

```ts
public scoped(target: string | object): IScopedLogger {
  const tag = typeof target === 'string' ? target : target.constructor.name;
  const prefix = `[${tag}]`;
  // ...
  debug: (message: string, ...args: unknown[]) => {
    // debug 仅开发构建生效：生产排障靠 info/warn/error，高频细节不进文件
    if (!isDev) return;
    this.mainLogger.debug(`${prefix} ${message}`, ...args);
  },
}
```

渲染进程拿不到 electron-log，preload 提供一个 console 同手感的日志桥，每次调用双写：

→ 源码：[packages/preload/src/logger.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/preload/src/logger.ts)

```ts
// 第一份：原生 console 回显 + 原始 args——DevTools 里对象可交互展开，与手写 console 体验一致。
nativeConsole[level](message, ...cleanArgs);

// 第二份：clone 安全预处理后经 diagnostics:log 落盘（静默管道，不生成独立 traceparent）
const payload: LogInput = {
  level,
  message,
  args: toCloneSafeArgs(cleanArgs),
  traceId: finalTraceId,
  spanId: finalSpanId,
};
void ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_LOG, payload).catch(() => {
  // fire-and-forget：日志管道自身的故障不向业务调用方传播
});
```

参数在 preload 侧先做 clone 安全预处理（Error/function/循环引用/超深结构全部降级可读表示），主进程用 `util.format` 统一渲染——`%s` 模板、对象 inspect 的 console 手感得以保留，行超长自动截断（2000 字符上限）。

渲染日志进主进程前还有滑窗节流：每调用方每秒最多 50 条准入，超限静默丢弃并汇总一条告警，防止失控的渲染循环刷爆磁盘（→ 源码：[packages/main/src/services/diagnostics.service.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/services/diagnostics.service.ts)）。

日志行里的 trace 前缀与 `traces.ndjson` 里的 span 记录由 [全链路追踪（W3C-trace）](/main/tracing) 提供。

## 怎么抄

可观测性的日常用法：

- 主进程打日志一律 `getLogManager().scoped(this)`，别裸调 log 实例
- 渲染层调 IPC 一律走 `callIpc`（→ 源码：[packages/renderer/src/lib/ipc.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/lib/ipc.ts)）或 `useIpc` hook：成功行仅 dev 回显、失败行带 traceId 落盘，严禁打印入参（config 含本地路径、dialog 含 URL）
- 渲染层打日志用全局 `logger.info/warn/error(...)`——DevTools 回显与落盘双写，`console.log` 在生产打包后是不落盘的
- 用户侧排障入口是「打开日志目录」（`openLogFolder`）

注意点：

- `debug` 级别在打包后的构建里主进程、渲染层两侧都直接丢弃，生产排障只依赖 `info/warn/error`
