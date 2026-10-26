---
title: 应用更新（Electron-updater）
description: 关掉自动下载与自动安装，改由快照状态机 + IPC 推送 + 孤儿下载看门狗推进。
---

# 应用更新（Electron-updater）

> **TL;DR**：关掉自动下载与自动安装，改由快照状态机 + IPC 推送 + 孤儿下载看门狗推进

## 要解决的坑

- 用户升级要么全量重下、要么静默装完强重启，还可能出现下载到一半没人管的僵尸进程

## 差分热更新：受控状态机 + 孤儿下载守护

→ 源码：[packages/main/src/services/updater.service.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/services/updater.service.ts)

electron-updater 的「全自动更新」在这里被刻意关掉，改由显式状态机推进：

```ts
updater.logger = this.logger;
updater.autoDownload = false;
updater.autoInstallOnAppQuit = false;
updater.fullChangelog = true;

const channel = getEnv('DISTRIBUTION_CHANNEL');
if (channel) {
  updater.channel = channel;
}
```

发现新版本、下载、安装全部由 `UpdaterService` 的快照状态机（idle / checking / available / downloading / downloaded / up-to-date / error 七态，`UpdaterState` 由 `@app/shared` 的 zod schema 推导）流转，经 IPC 推给渲染层更新窗口；下载进度按时间阈值节流推送，不刷屏。

下载用 `CancellationToken` 支持中途取消：

```ts
this.cancellationToken = new CancellationToken();
this.snapshot.state = 'downloading';
// ...
await updater.downloadUpdate(this.cancellationToken);
```

安装时机分场景：主窗口存活走更新窗口确认 `quitAndInstall(false, true)`；用户此前关过更新窗口就降级为系统通知，点击再拉起安装入口。

最特殊的是孤儿下载守护：用户在下载中直接关掉应用，主进程不退出，转后台继续下载，看门狗兜底超时强制取消并退出：

```ts
public startOrphanWatchdog(timeoutMs = ORPHAN_WATCHDOG_TIMEOUT_MS): void {
  this.isOrphan = true;
  if (this.orphanWatchdogTimer) {
    clearTimeout(this.orphanWatchdogTimer);
  }
  this.logger.info(`Starting orphan download watchdog for ${timeoutMs}ms`);
  this.orphanWatchdogTimer = setTimeout(() => {
    this.logger.error('Orphan download watchdog timed out. Cancelling and quitting.');
    // ……（源码此处继续：取消下载令牌、系统通知用户、app.quit()）
  }, timeoutMs);
}
```

孤儿态下载完成时执行静默安装 `quitAndInstall(true, false)`——不打扰用户，重启即新版本。错误统一过 `classifyUpdaterError` 分类成语义化 `ErrorCode`，并按阶段打点 Sentry。

差分升级的物料由本仓库备齐：打包配置声明 `generateUpdatesFilesForAllChannels: true` 生成全通道更新元数据（`build/electron-builder.ts`），Release 流水线把 `*.blockmap` 差分索引与 `latest.yml` 元数据连同安装包一起上传（见 [发版流水线（Changelogen）](/delivery/release-pipeline)）。electron-updater 的升级客户端按 blockmap 比对新旧版本、只下载差异块——这是该库的内置行为，不在本仓库代码内，本仓库保证的是物料就位。未打包形态（源码运行）读不到 `resources/app-update.yml`，改用编译期注入的 `repository.url` 坐标手动 `setFeedURL`；dev 模式全链路模拟，不请求真实源。

## 怎么抄

- **升级与 AI 评审**：electron-updater 关 `autoDownload` / `autoInstallOnAppQuit`，包一层状态机 + IPC 推送 + 孤儿看门狗

AI 评审部分见 [AI 评审闭环（Open-code-review）](/ai/review-loop)。

注意点：

- 不要绕过 `UpdaterService` 直接调 autoUpdater：channel、feedURL、孤儿态、错误分类都挂在状态机上
