---
title: 窗口位置与尺寸（Window-state）
description: 首启几何由纯函数按主显示器工作区计算，续启交给 Electron 官方 windowStatePersistence 在构造期恢复，不手写 keeper。
---

# 窗口位置与尺寸（Window-state）

> **TL;DR**：首启几何由纯函数按主显示器工作区计算，续启交给 Electron 官方 `windowStatePersistence` 在构造期恢复，不手写 keeper。

## 要解决的坑

窗口位置与尺寸是最容易被低估的一块。手写 keeper 要自己处理事件监听、防抖、磁盘写入、显示器拔插与越界回退（旧实现 191 行）；想在恢复时保留最大化，如果在窗口构造完成后再手动 `maximize()`，会出现先按构造尺寸显示、再跳成最大化尺寸的抖动。

Electron 44+ 提供了官方 `windowStatePersistence`，但它仍是实验性 API、不支持「只恢复最大化」，也**不负责首次启动的自适应尺寸与居中**——直接接入而不补首启几何，全新用户目录下会得到一个按构造参数硬编码的小窗口。

## 本仓库的解法

### 首启几何：纯函数算自适应尺寸与居中

→ 源码：[packages/main/src/modules/window/window-size.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/window/window-size.ts)

```ts
// 首次启动的尺寸与居中由纯函数计算；若存在官方持久化状态，
// Electron 会在构造期用保存的 bounds/displayMode 覆盖这些构造参数
const initialBounds = resolveWindowBounds(null, screen.getPrimaryDisplay());
```

首个参数恒为 `null`：本仓库不读上一次的 bounds，续启恢复完全交给 Electron。默认宽高 1024×700，宽度上限为工作区的 95%、高度上限 85%，下限 720×480；坐标按工作区绝对居中，能正确处理副屏与顶部任务栏偏移。历史尺寸超出当前工作区（例如拔掉 4K 显示器）或坐标越界时，重置为居中。

→ 源码：[packages/shared/src/constants/window-geometry.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/constants/window-geometry.ts)

默认值、工作区比例与越界容差都在这个跨端常量文件里；E2E 直接 import 同一份，不再抄写第二份数值。

### 续启交给官方 windowStatePersistence

→ 源码：[packages/main/src/modules/window/index.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/window/index.module.ts) · [packages/shared/src/constants/windows.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/constants/windows.ts)

```ts
name: WINDOW_IDS.HOME,                   // 唯一 name 即持久化存储键
windowStatePersistence: this.keepState,  // 布尔形式：bounds 与 displayMode 均默认开启
```

官方在窗口构造期完成恢复（原生窗口构造、min/max 约束之后，`Show()` 之前），因此不会出现「先按构造尺寸显示、再跳成保存尺寸」。恢复是按 `name` 索引的：`WINDOW_IDS.HOME` 定义在 shared 常量里，同时充当存储键，不要写成散落的字符串字面量。

也正因为恢复发生在构造期，构造完成后再监听 `persisted-state-restored` 已经收不到——本仓库改为创建后记录一次 `getNormalBounds()` 日志。恢复 `displayMode` 时最大化 / 全屏 / kiosk 会一起回来，所以不再需要手动 `maximize()`。

### 首帧可见与 win32 补偿

构造参数不设 `show: false`：窗口创建即可见，首帧是 `backgroundColor` 的主题底色（与 WCO overlay 同源，见[原生窗口体验（WCO）](/ui/wco)），避免「先白屏再出现」。

win32 无边框窗口偶发「任务栏有图标但窗口不可见」，因此在 `dom-ready` 时补一次 `show() + focus()`。

### 重置与断代

- 状态存于 Chromium `Local State`（`userData/Local State`，pref key `windowStates`，按窗口 `name` 索引），不再有 `window-state.json`。
- 重置布局：`BrowserWindow.clearPersistedState('home')` 后重启。当前应用没有设置页入口，需要时接一个菜单项即可。
- 旧版本留下的 `window-state.json` 不会被读取或自动删除；确认无用后手动删掉即可。

### 怎么验证

→ 源码：[e2e/window-state.spec.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/e2e/window-state.spec.ts)

同一个 `userDataDir` 启动两次：第一次 `setBounds({ x: 120, y: 90, width: 900, height: 620 })`，关闭后在相同目录重启，断言 `getNormalBounds()` 与设置值一致（跨进程恢复容差 2px）；首次启动另断言尺寸不溢出工作区、垂直居中（容差 10px，容纳 Windows 无边框窗口 `getBounds()` 的隐形边框）。

Linux/Xvfb 没有窗口管理器，只断言 bounds；最大化恢复走 Windows 真机验证。断言策略见[端到端断言策略（Shell-stub + Tolerance）](/testing/e2e-assertions)。

## 怎么抄

1. **先算首启几何**：把默认尺寸、最小尺寸与工作区比例放进共享常量，用一个纯函数返回 `{ x, y, width, height }`，创建窗口时直接使用。
2. **加 name 与持久化开关**：`name` 用常量而不是字符串字面量（它同时是存储键），`windowStatePersistence: true` 即开启 bounds + displayMode。
3. **删掉手动恢复**：不要自己监听 resize 存盘、不要在构造后 `maximize()`；官方恢复在构造期完成。
4. **补 e2e**：复用同一 `--user-data-dir` 重启即可验证 bounds 恢复；跨进程数值断言一律留容差。

注意点：

- `windowStatePersistence` 仍标记 `_Experimental_`，Electron 精确锁版本（本仓库验证于 45.0.0），升级时重跑窗口状态用例。
- `displayMode` 会把最大化 / 全屏 / kiosk 一起恢复；官方不支持「只恢复最大化」，需要自定义就关掉 `displayMode` 自己补。
- Windows 分数缩放（125% / 150% / 175%）下官方实现每次启动可能漂移 1–2px，整数缩放稳定——这是[上游已知问题](https://github.com/electron/electron/issues/55245)，不是本仓库代码造成的。
- 不要引入 `electron-window-state` 之类的第三方 keeper；官方能力已覆盖同样场景。
