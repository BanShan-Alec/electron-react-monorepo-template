---
title: 首次关闭确认（Close-confirmation）
description: 首次关闭窗口时询问关闭窗口留在系统托盘或退出应用，记住选择并保留设置页反悔入口；10 秒无响应时不自动关闭。
---

# 首次关闭确认（Close-confirmation）

> **TL;DR**：首次关闭窗口时询问关闭窗口留在系统托盘或退出应用，记住选择并保留设置页反悔入口；10 秒无响应时不自动关闭。

## 要解决的坑

桌面应用的标题栏关闭按钮通常只表示关闭窗口，但用户容易把它理解为退出应用。若直接把「关闭窗口」绑定到退出，后台任务和托盘常驻体验会被意外中断；若默认常驻托盘，又可能让用户误以为应用已经退出。

## 本仓库的解法

### 主进程拦截首次关闭

→ 源码：[packages/main/src/modules/window/index.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/window/index.module.ts) · [packages/shared/src/schemas/config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/schemas/config.ts)

主进程在窗口 `close` 事件中检查 `closeBehaviorConfirmed`。首次关闭时调用 `preventDefault()`，再通过受限 preload API 通知渲染层展示选择框。关闭前的偏好保存在现有本地配置中：

- 选择「关闭窗口并留在托盘」会保存 `minimizeToTray: true`。
- 选择「退出应用」会保存 `minimizeToTray: false`。
- 两个选择都会保存 `closeBehaviorConfirmed: true`，之后继续复用既有关闭逻辑。
- 取消不会写入偏好，再次关闭时会重新询问。

主窗口关闭后会销毁窗口实例，应用继续驻留系统托盘；点击托盘图标会重建并打开主窗口。设置页的「关闭窗口后在系统托盘中保留应用」开关仍可随时修改该偏好；用户操作开关也会标记关闭行为已确认。

### 弹窗与超时兜底

→ 源码：[packages/renderer/src/components/close-behavior/CloseBehaviorDialog/index.tsx](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/components/close-behavior/CloseBehaviorDialog/index.tsx) · [packages/preload/src/index.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/preload/src/index.ts)

renderer 使用 antd 弹窗：一句标题、一句说明，底部右下角两枚按钮「退出应用」与「留在托盘」。右上角 X 是取消入口；Esc 和遮罩都不能关闭弹窗，只有点击 X 才撤销本次询问。初始焦点放在“留在托盘”上。renderer 注册就绪后，主进程才推送待处理的关闭请求，避免启动早期事件丢失。

关闭请求等待 10 秒后会记录仍在等待用户选择，但不会关闭窗口、退出应用或替用户记住偏好；弹窗继续等待。

## 怎么验证

→ 源码：[e2e/close-behavior.spec.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/e2e/close-behavior.spec.ts)

端到端用例以全新 `userData` 冷启动，覆盖：选择关闭窗口并核对配置落盘、取消后仍存活且再次关闭会重问、等待超过 10 秒后窗口和弹窗仍可用并能继续完成选择。退出应用的主进程分支沿用现有关闭逻辑；改动主进程后运行 `pnpm test:e2e:build`，确保测试使用最新构建产物。

## 怎么抄

1. 将「是否已经确认」与实际关闭策略分开持久化；已有设置项继续作为用户之后修改策略的入口。
2. 在主进程窗口 `close` 事件里拦截首次关闭，窗口生命周期决策留在主进程。
3. 通过 preload 暴露单向关闭请求订阅和受校验的选择回传，不直接向 renderer 暴露 Electron 对象。
4. 给 renderer 事件订阅加就绪握手；无响应时保留待处理请求，不自动关闭或退出。
5. 分别验证三种选择、配置落盘和超时后弹窗仍可操作。

关闭行为依赖系统标题栏的窗口关闭事件；原生标题栏定制见[原生窗口体验（WCO）](/ui/wco)，窗口恢复与尺寸管理见[窗口位置与尺寸（Window-state）](/ui/window-state)。
