# 客户端日志、链路追踪与异常上报开发指南 (Developer Cheatsheet & Handbook)

> 本文档是面向业务开发的**实战速查手册**。不讲过多抽象理论，以直接可复制的代码模板（Copy-Paste Templates）、Do/Don't 对照表为主，指导开发者在主进程与渲染进程中规范打日志、贯通 Trace ID 并在合理时机向 Sentry 上报异常。

---

## 目录
- [一、 全局核心铁律 (Do's & Don'ts)](#一-全局核心铁律-dos--donts)
- [二、 日志怎么打 (Logging Cheatsheet)](#二-日志怎么打-logging-cheatsheet)
  - [1. 主进程打法 (`ScopedLogger`)](#1-主进程打法-scopedlogger)
  - [2. 渲染进程打法 (全局 `logger`)](#2-渲染进程打法-全局-logger)
  - [3. 日志落盘与文件结构](#3-日志落盘与文件结构)
- [三、 Trace 怎么打与链路穿透 (Tracing & Telemetry)](#三-trace-怎么打与链路穿透-tracing--telemetry)
  - [1. 跨进程 IPC 调用贯通闭环](#1-跨进程-ipc-调用贯通闭环)
  - [2. 渲染端显式绑定业务 Trace](#2-渲染端显式绑定业务-trace)
  - [3. 管道静默原则 (禁止伪 Trace)](#3-管道静默原则-禁止伪-trace)
  - [4. 三文件联动排查法](#4-三文件联动排查法)
- [四、 异常怎么报与 Sentry 闭环 (Error & Sentry)](#四-异常怎么报与-sentry-闭环-error--sentry)
  - [1. 跨进程统一契约与错误码](#1-跨进程统一契约与错误码)
  - [2. 前端展示友好脱敏 vs 本地日志留存](#2-前端展示友好脱敏-vs-本地日志留存)
  - [3. Sentry 上报实战规范](#3-sentry-上报实战规范)
  - [4. Sentry 上报决策矩阵 (该报 vs 不该报)](#4-sentry-上报决策矩阵-该报-vs-不该报)
- [五、 常用代码模板速查 (Copy-Paste Boilerplates)](#五-常用代码模板速查-copy-paste-boilerplates)

---

## 一、 全局核心铁律 (Do's & Don'ts)

| 场景 | ✅ 推荐做法 (DO) | ❌ 严禁做法 (DON'T) |
| :--- | :--- | :--- |
| **日志语言** | 所有落盘日志**必须且只能使用英文**（如 `Failed to query device: timeout`）。 | 严禁在落盘日志中出现中文字符（用户可见的 UI 走 i18n 多语言，日志始终纯英文）。 |
| **敏感数据** | 参数日志进行脱敏处理，仅打印操作与状态结果。 | 严禁把用户密码、Token、个人隐私、本地文件全路径打进日志。 |
| **IPC 失败日志** | 统一由 `callIpc` 在中心记录 `logger.error`，主进程由 `handleTraced` 记录 `error`。 | 严禁在具体的 Feature 组件或 Hook 里面重复打印 `logger.error`（避免日志双写）。 |
| **主进程日志实例** | 使用 `getLogManager().scoped('ModuleName')`。 | 严禁在主进程直接使用原生 `console.log/warn/error`（打包后在 Windows 会直接丢弃）。 |
| **渲染端日志通道** | 使用全局 `logger.info / warn / error / debug`（DevTools 与落盘双写）。 | 严禁手写 `window.api.diagnostics.log`。 |
| **Trace 关联** | 报错排查必须依赖自动回传的 `traceId`，或使用 `logger.withTrace(traceId).error(...)`。 | 严禁在传输管道（如 `diagnostics:log`）中生成新的业务 Span 掩盖真实调用链。 |
| **UI 报错呈现** | 拦截底层 C++/libusb 原生字符串，按 `err.code` 给出用户看得懂的本地化提示。 | 严禁把 `getString error 31` 等底层乱码裸露弹窗给普通用户。 |

---

## 二、 日志怎么打 (Logging Cheatsheet)

### 1. 主进程打法 (`ScopedLogger`)

在主进程中，统一通过 `LogManager.scoped(this)` 或 `LogManager.scoped('ModuleName')` 获取带有模块前缀的 Logger：

```ts
import { getLogManager } from '../modules/log.module';

export class DeviceService {
  // 1. 初始化 Scoped Logger（自动添加 [DeviceService] 前缀）
  private readonly logger = getLogManager().scoped(this);

  public async connect(deviceId: string): Promise<boolean> {
    // 2. 正常生命周期 / 关键里程碑 -> info
    this.logger.info(`Connecting to device (id=${deviceId})`);

    try {
      await this.doConnect(deviceId);
      this.logger.info(`Device connected successfully (id=${deviceId})`);
      return true;
    } catch (err) {
      // 3. 非预期故障 -> error，必须携带堆栈
      this.logger.error(`Failed to connect device (id=${deviceId}):`, err);
      throw err;
    }
  }

  public checkStatus(isIdle: boolean): void {
    // 4. 高频内部调试细节 -> debug（生产构建自动 no-op，不落盘）
    this.logger.debug(`Device poll check: isIdle=${isIdle}`);
  }
}
```

#### 日志级别选择准则：
- `info`：关键生命周期（模块启动、窗口创建、配置变更、版本检查结果）。
- `warn`：可预期且已兜底的异常（如业务参数校验失败、重试探测、节流丢弃提示）。
- `error`：系统级故障、硬件/网络通讯失败、捕获到的未预期原生错误（**必须附带 Error 对象以保留堆栈**）。
- `debug`：高频轮询、逐帧计算细节（仅开发构建输出，生产环境自动忽略，不落盘）。

---

### 2. 渲染进程打法 (全局 `logger`)

渲染进程在 preload 中挂载了全局 `logger`（在 `env.d.ts` 中声明，可直接裸调）：

```ts
// 1. 窗口与关键交互 -> info
logger.info('Route changed', { path: '/dashboard' });
logger.info('Document started', { entry: 'home' });

// 2. 走 IPC 的请求：
// ❌ 不需要手写 logger 记录失败！lib/ipc.ts 的 callIpc 已自动在失败时写入 logger.error！
// ✅ 仅需在业务需要时记录“操作成功”：
const { run: handleSave } = useIpc('config.update', window.api.config.update, {
  onSuccess: () => {
    logger.info('User updated system configuration');
  },
  // 失败已经被 callIpc 自动中心化记录为 error，无需在此重复写 logger
});
```

---

### 3. 日志落盘与文件结构

日志由主进程统一管理落盘，各日志文件作用与配置如下：

| 文件名 | 内容归属 | 轮转机制 | 查看说明 |
| :--- | :--- | :--- | :--- |
| **`main.log`** | 主进程所有控制器、服务、生命周期的运行与错误日志 | 满 5MB 自动重命名为时间戳备份（保留最多 5 份） | 搜索 `[error]`、`[ModuleName]` 定位后台核心异常 |
| **`renderer-<window>.log`** | 特定渲染窗口（如 `home`、`updater`）上报的日志 | 窗口隔离，独立 5MB 时间戳归档 | 搜索 `[Renderer] [home]`，可查看前端执行与路由足迹 |
| **`traces.ndjson`** | W3C 遥测 Span 记录（每行一个 JSON） | 独立 10MB 轮转 | 存放调用耗时拓扑图，通过 `trace_id` 检索端到端耗时 |

---

## 三、 Trace 怎么打与链路穿透 (Tracing & Telemetry)

### 1. 跨进程 IPC 调用贯通闭环

本项目采用类似 OpenTelemetry 的 **Mini-OTel** 链路追踪体系。一次完整的 IPC 调用链路如下：

```text
[Renderer]                  [Preload]                     [Main Process]
callIpc() -----------> invokeTraced() -----------> handleTraced()
                          生成 W3C TraceParent           开启 Active Span
                                                           │
                                                           ├─ 执行 Service 业务逻辑
                                                           ├─ 失败自动记录 main.log [error]
                                                           └─ Result 中注入 res.traceId = span.traceId
                             返回 Result<T> (带 traceId)
                                  │
catch (IpcError) <────────────────┘
提取 error.traceId
logger.withTrace(traceId).error() ──[轻量原生通道]──> 写入 renderer-home.log
```

---

### 2. 渲染端显式绑定业务 Trace

如果需要在渲染端打印与某次业务 IPC 紧密相关的错误日志，请使用 `withTrace`：

```ts
// 当捕获到携带 traceId 的 IpcError 时：
try {
  await callIpc('usb.getDeviceList', window.api.usb.getDeviceList, []);
} catch (err) {
  if (err instanceof IpcError && err.traceId) {
    // 显式绑定该次 IPC 业务的 traceId
    logger.withTrace(err.traceId).error(`Failed to handle device event: ${err.message}`);
  }
}
```

---

### 3. 管道静默原则 (禁止伪 Trace)

- **`diagnostics:log` 仅作为静默传输管道**：主进程采用原生 `ipcMain.handle` 注册，**严禁使用 `handleTraced`**，以防在 `traces.ndjson` 刷满无意义的日志垃圾 Span。
- **渲染日志行 Trace 归属**：
  - 普通生命周期日志（如 `App started`）不打伪 Trace ID，保持干净纯粹；
  - 业务失败日志仅打**真实的业务 `trace_id`**，确保与 `main.log` 一一对应。

---

### 4. 三文件联动排查法

当生产环境或测试报错时，排查三部曲：

1. **第一步：看 `renderer-home.log` 捞取 Trace ID**
   ```text
   [error] [trace_id:38389d723a1d592e13dae64282fe13bc] [Renderer] [home] [ipc] usb.getDeviceList failed 29.6ms: getString error 31
   ```
   复制该 `trace_id`：`38389d723a1d592e13dae64282fe13bc`。

2. **第二步：在 `main.log` 搜索该 Trace ID**
   ```text
   [error] [trace_id:38389d723a1d592e13dae64282fe13bc] [IPC] [home] usb:get-device-list failed (29.6ms): getString error 31 [code: INTERNAL_ERROR]
   ```
   直接查到主进程对应的业务调用堆栈。

   > 级别注意：`[IPC]` 行的级别取决于错误码——`INTERNAL_ERROR` 落 `[error]`，业务语义码（如 `UPDATER_ALREADY_RUNNING`）落 `[warn]`。

3. **第三步：在 `traces.ndjson` 搜索该 Trace ID 查看耗时与事件**
   ```json
   {"type":"span","name":"ipc.receive:usb:get-device-list","trace_id":"38389d723a1d592e13dae64282fe13bc","duration_ms":29.6,"status":"ERROR","events":[{"name":"business_error","attributes":{"error.code":"INTERNAL_ERROR"}}]}
   ```

4. **事件推送型错误的降级查法（无 trace 可捞时）**：不经 invoke 的错误（如 electron-updater 后台报错经 `updater:event:state` 推送、或窗口打开时拉到 `state === 'error'` 快照）在渲染侧只有一行「呈现行」（如 `[updater] Error state presented:`），不带 trace_id、不产生 span。此时按写入点文案检索 `main.log`（如 `Update error:`、`Update check failed:`），再回看 `renderer-<window>.log` 的呈现行对齐时间线。主进程背景异步（事件回调、定时器）同样无 trace，属预期，按写入点文案检索即可。

---

## 四、 异常怎么报与 Sentry 闭环 (Error & Sentry)

### 1. 跨进程统一契约与错误码

主进程任何 IPC 接口必须返回 `Result<T>` 结构体（定义于 [`packages/shared/src/types/result.ts`](file:///h:/electron-app-temp5/packages/shared/src/types/result.ts)）：

```ts
export type Result<T> =
  | { success: true; data: T; traceId?: string }
  | { success: false; error: string; code?: string; traceId?: string };
```

- 严禁手写数字状态码（如 404/500）。
- 必须使用 `ErrorCode` 常量（[`packages/shared/src/constants/error-codes.ts`](file:///h:/electron-app-temp5/packages/shared/src/constants/error-codes.ts)），如 `ErrorCode.INTERNAL_ERROR`、`ErrorCode.VALIDATION_ERROR`。

---

### 2. 前端展示友好脱敏 vs 本地日志留存

**核心原则**：底层技术细节留在日志里（方便对账），呈现在界面上的永远是用户看得懂的本地化提示。

```ts
// packages/renderer/src/features/usb/hooks/useUsbDevices.ts
const { run: fetchDevices } = useIpc('usb.getDeviceList', window.api.usb.getDeviceList, {
  onError: (err) => {
    // 1. 判断是否为特定底层硬件/原生驱动错误
    const isDescriptorError = /getString error|error 31/i.test(err.message);

    // 2. 转换为友好的多语言 UI 提示
    const tip = isDescriptorError
      ? t`无法读取部分 USB 设备描述符，请检查设备连接或系统权限`
      : t`获取 USB 设备列表失败: ${err.message}`;

    message.error(tip);
    // 3. 底层报错在 callIpc 中已经被记录在 renderer.log 中，无需担心技术信息丢失
  },
});
```

---

### 3. Sentry 上报实战规范

Sentry 在主进程与渲染进程均已完成配置，使用时应遵从**分层上报**：

#### A. 主进程上报（硬件、系统、主进程核心服务）
```ts
import * as Sentry from '@sentry/electron/main';

try {
  await doSystemOperation();
} catch (err) {
  // 必须带 tags 用于在 Sentry 后台聚类分组
  Sentry.captureException(err, {
    tags: {
      domain: 'hardware.usb', // 业务域
      platform: process.platform,
    },
    extra: {
      deviceId,
      traceId, // 绑定当前的 traceId，打通云端与本地日志
    },
  });
}
```

#### B. 渲染进程上报（UI 交互异常、前端逻辑崩溃）
```ts
import * as Sentry from '@sentry/electron/renderer';

// 在 React 局部组件或核心交互失败处：
Sentry.captureException(err, {
  tags: {
    domain: 'ui.checkout',
  },
  extra: {
    traceId: err.traceId,
    code: err.code,
  },
});
```

---

### 4. Sentry 上报决策矩阵 (该报 vs 不该报)

| 场景 | 是否上报 Sentry？ | 建议日志级别 | 理由 |
| :--- | :---: | :---: | :--- |
| **未捕获的全局崩溃 / OOM** | ✅ **必报** | `error` | Sentry SDK 已自动托管，无需手动编码 |
| **底层硬件/驱动不可逆故障**（如 USB 枚举崩溃） | ✅ **上报** | `error` | 有助于收集不同机型、系统版本兼容性问题 |
| **文件读写权限异常 / IO 崩溃** | ✅ **上报** | `error` | 影响核心功能的严重系统故障 |
| **表单校验未通过 (`VALIDATION_ERROR`)** | ❌ **不报** | `warn` | 用户预期内操作输入，上报会污染 Sentry 配额 |
| **用户主动取消对话框 / 取消升级** | ❌ **不报** | `info` | 正常交互流程，不属于程序异常 |
| **接口网络超时（偶发重试成功）** | ❌ **不报** | `warn` | 仅做本地警告，避免网络波动刷屏 |

---

## 五、 常用代码模板速查 (Copy-Paste Boilerplates)

### 模板 1：新建主进程 Controller
```ts
import { IPC_CHANNELS } from '@app/shared/constants/ipc-channels';
import type { Result } from '@app/shared/types/result';
import { handleTraced } from '../telemetry/ipc-tracer';
import { catchToResult, successResult } from './utils';

export function registerMyModuleControllers(): void {
  // handleTraced 会自动：
  // 1. 抽取 TraceContext 并生成 Span
  // 2. 失败自动打印 main.log [error]
  // 3. 返回体自动注入 res.traceId
  handleTraced(IPC_CHANNELS.MY_CHANNEL, async (_event, payload: unknown): Promise<Result<MyData>> => {
    try {
      const data = await myService.execute(payload);
      return successResult(data);
    } catch (err) {
      return catchToResult(err); // 自动识别 AppError 与 ErrorCode
    }
  });
}
```

### 模板 2：新建主进程 Service（带防御式容错与日志）
```ts
import { getLogManager } from '../modules/log.module';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '@app/shared/constants/error-codes';

export class MyService {
  private readonly logger = getLogManager().scoped(this);

  public async getSafeData(): Promise<Item[]> {
    try {
      return await this.fetchNativeList();
    } catch (err) {
      this.logger.warn('Failed to fetch native list, falling back to empty list:', err);
      return []; // 优雅降级，防止主进程中断
    }
  }
}
```

### 模板 3：渲染进程 Feature Hook 请求
```ts
import { t } from '@lingui/core/macro';
import { App } from 'antd';
import { useIpc } from '@/hooks/useIpc';

export function useMyFeature() {
  const { message } = App.useApp();

  const { data, loading, run } = useIpc('my.channel', window.api.my.channel, {
    onError: (err) => {
      // 业务自定义脱敏文案
      message.error(t`操作失败，请重试`);
    },
    onSuccess: () => {
      logger.info('My feature updated successfully');
    },
  });

  return { data, loading, run };
}
```
