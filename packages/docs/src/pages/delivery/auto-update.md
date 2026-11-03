---
title: 应用更新（Electron-updater）
description: 采用显式快照状态机接管更新生命周期，禁用静默强装，退出时安全取消下载与节流推送。
---

# 应用更新（Electron-updater）

> **TL;DR**：全面接管 `electron-updater`。刻意关闭 `autoDownload` 与 `autoInstallOnAppQuit`，通过 7 态受控快照状态机向渲染层节流推送进度，支持中途取消下载，并在应用退出时清理未完成临时包，杜绝后台僵尸进程与文件锁冲突。

## 1. 选型理由

- **规避静默强装与卡顿**：官方默认行为是在后台静默全量下载并在应用退出时强制重启安装，若用户正处于未保存的关键工作流中将造成严重灾难。
- **状态透明与节流推送**：通过统一的受控状态机（7 态），配合高频下载进度的节流（Throttle）广播，更新进度窗口始终保持 60fps 平滑流畅而不挤爆 IPC。
- **全通道与差分更新支持**：物料由打包阶段一键产出 `.blockmap` 索引，`electron-updater` 客户端按需实现分块差量下载，节约带宽与等待耗时。

## 2. 核心配置与实现

### 显式禁用默认行为与状态机定义

→ 源码：[packages/main/src/services/updater.service.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/services/updater.service.ts)

```ts
import type { UpdaterState, UpdaterSnapshot } from '@app/shared/types/updater';
import electronUpdater, { CancellationToken } from 'electron-updater';

// 核心原则：彻底关闭官方默认自动下载与强行退出安装
updater.autoDownload = false;
updater.autoInstallOnAppQuit = false;
updater.fullChangelog = true;

// 状态机 7 大标准状态（单一真源来自 @app/shared 契约定义）
// UpdaterState: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'
```

### 可取消下载与退出收尾

```ts
// 1. 通过 CancellationToken 支持用户主动取消或应用退出时中止
this.cancellationToken = new CancellationToken();
this.snapshot.state = 'downloading';
await updater.downloadUpdate(this.cancellationToken);

// 2. 退出时安全终止：未完成的临时文件立即取消，不留僵尸任务
public cancelDownload(): void {
  if (this.cancellationToken && this.snapshot.state === 'downloading') {
    this.cancellationToken.cancel();
    this.cancellationToken = null;
    this.snapshot.state = 'idle';
  }
}

// 3. 安装时机控制：主窗口存在时打开更新对话框；用户确认后再触发安装重启
updater.quitAndInstall(false, true); // isSilent=false, isForceRunAfter=true
```

## 3. 桌面端避坑注意事项

| 避坑要点 | 事故表现与原因 | 本仓库对齐方案 |
| :--- | :--- | :--- |
| **退出应用被文件锁卡死** | 用户正在下载 200MB 安装包时突然关闭应用，未关闭的下载任务持有本地临时文件句柄，导致下次启动安装包损坏或进程挂起。 | 在应用退出流程（`before-quit` / 最后一个窗口关闭）中显式调用 `cancelDownload()` 取消未完成的流并清理句柄。 |
| **源码/开发模式更新报错** | 在 `pnpm dev` 下执行检查更新，由于未打包状态下缺少 `resources/app-update.yml`，导致程序直接抛出未捕获异常。 | 在开发态自动拦截并使用本地 Mock 逻辑，生产态基于 `package.json` 的 `repository.url` 自动合成更新源。 |
| **高频 Progress 冲垮渲染层** | 宽带极速下载时，`download-progress` 事件每秒触发数百次，频繁触发 IPC 序列化与 React 重新渲染致使界面卡死。 | 在主进程内部引入 `PROGRESS_EMIT_THROTTLE_MS`（节流阀），将推送频率严格限制在每 100ms 一次。 |
| **错误分类与语义提示缺失** | 报错仅显示 `Error: net::ERR_CONNECTION_TIMED_OUT` 等底层原始堆栈，用户无法理解。 | 通过 `classifyUpdaterError` 将网络超时、哈希校验失败、文件占用等异常映射为结构化 `ErrorCode` 并附带友好中文提示。 |
