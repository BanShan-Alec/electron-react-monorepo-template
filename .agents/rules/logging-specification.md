---
description: 落盘日志语言与用词规范（English-only, simple & concise logging）
globs: packages/**/*.{ts,tsx}
---

# 落盘日志语言与用词规范 (English-Only Logging Specification)

在本项目中，所有持久化写入磁盘日志（包括 `main.log`、`renderer-<window>.log`、`electron-log` 以及 `LogManager` / `ScopedLogger`）的代码必须严格遵循以下原则：

## 1. 强制纯英文（English Only）
- **禁止中文**：落盘日志消息字符串必须使用纯英文，严禁写入中文字符或中英夹杂。
- **与 UI 解耦**：用户可见的页面文案、弹窗对话框、系统 Notification 提示走 i18n 多语言体系，但后台落盘日志必须始终为英文。

## 2. 用词简单常用（Simple & Standard Vocabulary）
- 选用高频、通用的技术英语单词，杜绝生僻词或复杂语法结构。
- 动词推荐：
  - 初始化与生命周期：`init`, `start`, `stop`, `ready`, `create`, `destroy`, `restore`, `close`, `hide`, `quit`
  - 成功与失败：`success`, `failed`, `skipped`, `intercepted`, `timeout`
  - 交互与传输：`send`, `receive`, `push`, `emit`, `listen`, `register`, `request`

## 3. 句子简短易懂（Concise & Direct Sentences）
- 保持句子精炼（建议 3~10 个词），优先使用祈使句或现在完成时动宾短语。
- 统一错误日志句式：`Failed to <action>: <reason>` 或 `Cannot <action>: <reason>`。

## 4. 示例对比

### ❌ 错误示范
```ts
logger.info('[Sentry] 主进程初始化成功（仅打包采集 + 行为/性能监控已禁用）');
logger.warn('获取无响应窗口 URL 失败:', err);
logger.error('渲染进程非预期退出:', details);
```

### ✅ 正确示范
```ts
logger.info('Sentry initialized successfully');
logger.warn(`Failed to get URL for unresponsive window (id=${window.id}):`, err);
logger.error(`Renderer process gone unexpectedly: reason=${details.reason}`);
```

## 5. 渲染进程叙事纪律（全局 logger）

- **生命周期事件记 info**：入口启动（`App started`，两个 entry 各一行）、路由切换（`Route changed`，每次路径变化一行）、ErrorBoundary 崩溃（error 级，带 `componentStack`）。
- **用户动作只记操作结果**：成功/失败各一行，不记意图与参数；本地路径、URL、业务数据一律不入日志。
- **走 IPC 的动作只补成功行**：失败已被 `lib/ipc.ts` 的 `logIpc` 中心化记录（channel + 耗时 + 错误文案），feature 层再记即双写。
- **主进程 service 层已叙事的事件不重复记**：config 变更、更新检查/可用/下载等主进程已有 info 日志，渲染层不碰。
- **debug 级仅开发构建生效**：渲染 `logger.debug` 与主进程 `scoped().debug` 在生产构建均 no-op。
