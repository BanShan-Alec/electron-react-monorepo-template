---
title: 崩溃上报（Sentry）
description: 只在打包后且配置 DSN 时启用，渲染进程崩溃由主进程代报。
---

# 崩溃上报（Sentry）

> **TL;DR**：只在打包后且配置 DSN 时启用，渲染进程崩溃由主进程代报。

## 要解决的坑

崩溃静默发生，开发者永远不知道。

## 本仓库的解法

→ 源码：[packages/main/src/modules/sentry.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/sentry.module.ts)

激活条件刻意收窄：只打包后且配置了有效 DSN 才开启，开发期零网络开销、零上报噪音：

```ts
export function isSentryEnabled(): boolean {
  return app.isPackaged && Boolean(getSentryDsn());
}
```

采集范围最小化——只要崩溃，不要行为轨迹与性能剖析：

```ts
// 彻底关闭行为监控（Breadcrumbs / DOM / Console / Net 轨迹）
maxBreadcrumbs: 0,
beforeBreadcrumb: () => null,
integrations: (defaults) => defaults.filter((i) => !i.name.includes('Breadcrumb')),

// 彻底关闭性能监控（Tracing / Profiling）
tracesSampleRate: 0,
```

渲染进程崩溃走 app 级监听——进程都没了，渲染层自己报不了，只能主进程替它报：

```ts
app.on('render-process-gone', (_event, webContents, details) => {
  if (appLifecycle.isQuitting || details.reason === 'clean-exit') {
    return;
  }
  // ...
  Sentry.captureException(
    new Error(
      `[Renderer Crash] process gone: reason=${details.reason}, exitCode=${details.exitCode}`,
    ),
    {
      level: 'fatal',
      tags: buildSentryTags(APP_FEATURES.WINDOW, {
        // ...
        [SENTRY_TAGS.PROCESS]: 'renderer',
        [SENTRY_TAGS.CRASH_REASON]: details.reason,
        [SENTRY_TAGS.EXIT_CODE]: details.exitCode,
      }),
    },
  );
});
```

窗口未响应同样监听（`browser-window-created` 里给每个窗口挂 `unresponsive`，`captureMessage` 上报并附当前 URL）；退出流程中的正常关闭（`clean-exit`）不上报，避免噪音。

渲染层侧独立初始化（→ 源码：[packages/renderer/src/lib/sentry.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/lib/sentry.ts)），同样的严格守卫加 `ignoreErrors` 过滤 ResizeObserver 等前端噪声；SourceMap 用 `hidden` 模式构建，Sentry 插件上传后删除 map 文件，配合 electron-builder 排除规则确保 SourceMap 绝不进 asar（→ 源码：[packages/renderer/vite.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/vite.config.ts)）。

注意点：

- 未配 `SENTRY_DSN` 或处于开发模式时 Sentry 全链路静默，不报错也不上报——「没收到事件」先查这两个条件
