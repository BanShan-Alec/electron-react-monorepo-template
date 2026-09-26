# 客户端日志系统与异常防护多维度工程审查与整改指南

本文档全面梳理了 Electron 桌面客户端在**日志轮转存储、IPC 安全防打爆、主进程异常分级、Sentry 闭环以及可调试性**维度的架构现状、潜在隐患与整改升级方案。

---

## 目录
- [一、 维度一：日志轮转与存储机制审查](#一-维度一日志轮转与存储机制审查)
- [二、 维度二：IPC 日志通道与防打爆机制](#二-维度二ipc-日志通道与防打爆机制)
- [三、 维度三：主进程异常分级策略（可用性与容灾）](#三-维度三主进程异常分级策略可用性与容灾)
- [四、 维度四：Sentry 闭环与 SourceMap 自动化](#四-维度四sentry-闭环与-sourcemap-自动化)
- [五、 维度五：跨进程日志上下文追踪（可调试性）](#五-维度五跨进程日志上下文追踪可调试性)
- [六、 优先级整改路线图](#六-优先级整改路线图)
- [七、 代码级日志内容审查与自动补全改造](#七-代码级日志内容审查与自动补全改造)

---

## 一、 维度一：日志轮转与存储机制审查

### 1. `electron-log` 的“伪多文件轮转”陷阱
* **现状代码**：`packages/main/src/modules/log.module.ts` 中的 `cleanOldLogs`
* **问题隐患**：当前配置了 `cleanOldLogs(maxDays = 7, maxFiles = 5)`，试图在磁盘中保留最多 5 个历史归档文件。
  但在 `electron-log` v5 默认机制下，当文件满 5MB 轮转时，它默认只会将原文件重命名为 `main.old.log`。下次再满 5MB 时，它会**直接覆盖**已有的 `main.old.log`。
* **实际后果**：磁盘上**永远只有 1 个 `.old` 历史文件**，前面的 4 个历史归档在被清理前就已被覆盖吞掉，`maxFiles = 5` 的清理代码形同虚设。
* **整改方案**：自定义 `archiveLogFn`，按时间戳或自增序号轮转归档（例如 `main-2026-09-26-1.log`）：
  ```ts
  this.mainLogger.transports.file.archiveLogFn = (oldFile) => {
    const file = oldFile.toString();
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    fs.renameSync(file, file.replace(/\.log$/, `-${dateStr}.log`));
  };
  ```

### 2. `app.getPath('userData')` 生命周期越界
* **现状代码**：`packages/main/src/index.ts` 中的 `handleFatalCrash`
* **问题隐患**：通过 `app?.getPath?.('userData')` 获取目录。如果在 `app.whenReady()` 之前发生未捕获异常，调用 `app.getPath('userData')` 会直接抛出同步异常。
* **整改方案**：增加 `app.isReady()` 前置安全校验：
  ```ts
  const logDir = app.isReady()
    ? path.join(app.getPath('userData'), 'logs')
    : path.join(process.cwd(), 'logs');
  ```

---

## 二、 维度二：IPC 日志通道与防打爆机制

### 1. 缺失文本截断保护（大 Payload 内存攻击）
* **现状代码**：`packages/shared/src/schemas/diagnostics.ts` 中的 `logInputSchema`
* **问题隐患**：Zod 规则仅校验了 `message: z.string()`，未限制长度。如果前端被恶意注入或发生死循环拼装出一段 20MB 的超大错误文本并发起 IPC，主进程会直接全量序列化并写入磁盘，可能瞬间打爆 5MB 轮转上限甚至撑爆磁盘。
* **整改方案**：在 Zod Schema 中加入字符串硬限制：
  ```ts
  export const logInputSchema = z.object({
    level: z.enum(['info', 'warn', 'error', 'debug']).default('info'),
    message: z.string().max(2000, '日志消息长度不能超过 2000 字符'),
    meta: z.unknown().optional(),
  });
  ```

### 2. 缺失高频日志节流（Throttle / Rate Limit）
* **问题隐患**：如果渲染进程死循环调用 `window.api.diagnostics.log`，会导致主进程的消息队列被堵死，引发整机掉帧假死。
* **整改方案**：在主进程的 `DiagnosticsService` 中增加滑动窗口计数器，对同一个渲染进程限制 `1秒内最多写入 50 条日志`，超出部分抛弃并打印汇总告警。

### 3. 敏感信息脱敏（PII 数据合规）
* **问题隐患**：`meta` 对象直接原样落盘。若请求体中含有用户登录凭证、密码或 Token，会永久保留在本地明文日志中。
* **整改方案**：在写入 `rendererLogger` 前，对 `meta` 执行浅层键脱敏（将 `password`、`authorization`、`token` 替换为 `***`）。

---

## 三、 维度三：主进程异常分级策略（可用性与容灾）

### 1. `unhandledRejection` 一刀切 `process.exit(1)` 过于激进
* **现状代码**：`packages/main/src/index.ts`
* **问题隐患**：当前将 `unhandledRejection`（未捕获的 Promise）与 `uncaughtException`（同步崩溃）统一绑定到了 `handleFatalCrash`，一旦触发就强制弹窗 + 强杀应用。非核心背景轮询请求偶然漏抓时直接闪退，体验极差。
* **整改方案**：实行分级策略：
  - `uncaughtException`（同步栈崩溃，内存不可信）：**执行弹窗并退出**。
  - `unhandledRejection`（异步 Promise 漏抓）：**记录 Error 日志 + 上报云端**，不强杀应用。

### 2. 补齐 Chromium 进程级死亡监控
* **问题隐患**：未监听 `app.on('render-process-gone')` 和 `webContents.on('preload-error')`。
* **整改方案**：增加监听，当捕获到 `crashed` 或 `oom` 时，弹窗询问用户是否“重新载入”，提供原地恢复能力。

---

## 四、 维度四：Sentry 闭环与 SourceMap 自动化

### 1. 缺失版本标识（Release / Dist）
* **现状代码**：`packages/renderer/src/lib/sentry.ts`
* **问题隐患**：初始化未配置 `release` 字段，导致未来上传的 SourceMap 无法精准绑定到特定构建版本。
* **整改方案**：注入版本号（取自 `package.json` 的 version）：
  ```ts
  release: `electron-app@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`
  ```

### 2. 本地构建 SourceMap 清理链路
* **流程建议**：
  `Vite 构建生成 hidden sourcemap` ➡️ `CI 上传至 Sentry` ➡️ `删除本地 map` ➡️ `electron-builder 打包 asar`（配合已配的 `!**/*.map` 实现双重绝缘）。

---

## 五、 维度五：跨进程日志上下文追踪（可调试性）

* **痛点**：`main.log` 与 `renderer.log` 相互独立，排查问题时无法准确定位前后关联。
* **整改方案**：
  应用启动时生成全局轻量 `sessionId`，主进程与渲染进程落盘时统一携带前缀：
  `[{timestamp}] [{level}] [{sessionId}] [{process}] {text}`

---

## 六、 优先级整改路线图

| 优先级 | 整改项 | 对应文件 | 预期收益 |
| :---: | :--- | :--- | :--- |
| **P0 (高危)** | 区分 `unhandledRejection` 与同步崩溃，**避免非致命 Promise 导致整个应用闪退** | `packages/main/src/index.ts` | 彻底避免非致命错误导致闪退丢失用户数据 |
| **P0 (高危)** | IPC 日志加入 2000 字符限制，**防止超大文本打爆磁盘与内存** | `packages/shared/src/schemas/diagnostics.ts` | 拦截大 Payload 攻击，保障日志稳定性 |
| **P1 (核心)** | 修复 `electron-log` 轮转归档覆盖问题，确保能真正留存历史日志 | `packages/main/src/modules/log.module.ts` | 确保 5 个历史归档正常留存，防历史记录丢失 |
| **P1 (核心)** | 主进程补齐 `render-process-gone` 监听，提供渲染进程 OOM 恢复机制 | `packages/main/src/index.ts` | 避免内存溢出时界面透明/死白假死 |
| **P2 (规范)** | 为 Sentry 配置统一的 `release` 规范，对齐构建与 SourceMap 上传 | `packages/renderer/src/lib/sentry.ts` | 确保生产构建异常 100% 能够反编译还原源码 |
| **P2 (规范)** | 落地 ScopedLogger 自动补齐 `[Module]` 前缀，消除 console 通道混用 | `packages/main/src/modules/log.module.ts` 等 | 杜绝日志前缀拼写混乱与生产环境控制台日志丢失 |

---

## 七、 代码级日志内容审查与自动补全改造

### 1. 规范性问题（Consistency & Standardization）
* **混用 `console` 与 `mainLogger`**：
  - `modules/security/external-urls.ts#L25,L35`、`modules/security/block-origins.ts#L32`、`modules/auto-updater.module.ts#L48` 混用了原生 `console.warn`。
  - **后果**：Windows 生产打包无控制台环境下，输出直接丢弃进黑洞，`main.log` 无安全拦截记录。
* **前缀标签不一致与遗漏**：
  - `tray.module.ts#L75` 报错未带 `[Tray]`；`log.module.ts#L95` 报错未带 `[LogManager]`。

### 2. 完善性问题（Completeness & Coverage）
* **业务 IPC 控制器缺乏主进程日志**：
  - `dialog.controller.ts`、`counter.controller.ts` 等控制器在执行 IPC 时无日志沉淀，报错排查链路断档。
* **生命周期退出闭环缺失**：
  - 仅有启动日志，缺少 `before-quit` / `will-quit` 退出原因跟踪。

### 3. 冗余性问题（Redundancy & Noise）
* **连续无意义启动模板日志**：
  - `ipc.module.ts#L9-L11` 注册控制器的启动日志相隔 0ms 连发两条，纯属模板冗余。
* **前端高频 IPC 成功日志未收敛**：
  - `packages/renderer/src/lib/ipc.ts#L28` 每次 IPC 成功均执行 `console.info`，生产环境若存在高频 Ping 会造成控制台刷屏。

### 4. 方案 A：Scoped Logger 自动补全机制落地设计
为彻底解决手动拼接 `[ModuleName]` 容易遗漏和混乱的问题，在 `LogManager` 中提供 `scoped(target: string | object)` 原语：
```ts
export interface IScopedLogger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

export class LogManager {
  public scoped(target: string | object): IScopedLogger {
    const tag = typeof target === 'string' ? target : target.constructor.name;
    const prefix = `[${tag}]`;
    return {
      info: (msg, ...args) => this.mainLogger.info(`${prefix} ${msg}`, ...args),
      warn: (msg, ...args) => this.mainLogger.warn(`${prefix} ${msg}`, ...args),
      error: (msg, ...args) => this.mainLogger.error(`${prefix} ${msg}`, ...args),
      debug: (msg, ...args) => this.mainLogger.debug(`${prefix} ${msg}`, ...args),
    };
  }
}
```
* 各 Module 直接持有 `#logger = getLogManager().scoped(this)`，调用时无需关注中括号，输出统一且随 Class 名自适应。

