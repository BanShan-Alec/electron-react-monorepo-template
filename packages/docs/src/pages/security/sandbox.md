# 渲染进程沙箱（Sandbox）

> **TL;DR**：每个 `BrowserWindow` 的 `webPreferences` 写死 Node 关闭、上下文隔离、沙箱与 `webview` 关闭，对外只留 preload 白名单桥。

## 要解决的坑

Electron 的默认配置是「能跑」，不是「防住」：

- `nodeIntegration` 一开，网页里的一段注入脚本就等于拿到了 Node 全套能力

## 本仓库的解法

### 1. 渲染进程沙箱：webPreferences 四件套写死

→ 源码：[packages/main/src/modules/window/index.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/window/index.module.ts)

```ts
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webviewTag: false,
  preload: this.preload.path,
  additionalArguments: [getPackedEnvArgument()],
},
```

每个 `BrowserWindow` 的 `webPreferences` 都写死这套组合：渲染层没有 Node、没有 `ipcRenderer` 直连、preload 与页面上下文隔离、沙箱开启、连 `webview` 标签都关掉。唯一的对外面就是 preload 暴露的白名单桥（见[「类型安全的 IPC 契约」](/security/ipc-contract)）。updater 窗口同样一份配置，不因为「只是个更新提示窗」就放松：

→ 源码：[packages/main/src/modules/window/updater-window.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/window/updater-window.module.ts)

## 怎么抄

以新增窗口为例：

1. **新窗口固定四件套**：`webPreferences` 写死 `nodeIntegration: false` + `contextIsolation: true` + `sandbox: true` + `webviewTag: false`，preload 路径用 `require.resolve` 定位
