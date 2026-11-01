---
title: 应用更新（Electron-updater）
description: 关掉自动下载与自动安装，改由快照状态机 + IPC 推送推进；退出应用时取消未完成的下载。
---

# 应用更新（Electron-updater）

> **TL;DR**：关掉自动下载与自动安装，改由快照状态机 + IPC 推送推进；退出应用时取消未完成的下载

## 要解决的坑

- 用户升级要么全量重下、要么静默装完强重启，还可能出现下载到一半没人管的僵尸进程

## 差分热更新：受控状态机 + 退出取消下载

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

退出即放弃下载：用户在下载中选择退出应用（或未开启托盘常驻时关闭最后一个窗口）时，主进程先取消下载再退出，不保留后台进程。electron-updater 在取消时清理未完成的临时文件，下次启动重新检查并从头下载；已下载完成的安装包保留在缓存中，下次启动可直接安装。错误统一过 `classifyUpdaterError` 分类成语义化 `ErrorCode`，并按阶段打点 Sentry。

差分升级的物料由本仓库备齐：打包配置声明 `generateUpdatesFilesForAllChannels: true` 生成全通道更新元数据（`build/electron-builder.ts`），Release 流水线把 `*.blockmap` 差分索引与 `latest.yml` 元数据连同安装包一起上传（见 [发版流水线（Changelogen）](/delivery/release-pipeline)）。electron-updater 的升级客户端按 blockmap 比对新旧版本、只下载差异块——这是该库的内置行为，不在本仓库代码内，本仓库保证的是物料就位。未打包形态（源码运行）读不到 `resources/app-update.yml`，改用编译期注入的 `repository.url` 坐标手动 `setFeedURL`；dev 模式全链路模拟，不请求真实源。

## 怎么抄

- **升级与 AI 评审**：electron-updater 关 `autoDownload` / `autoInstallOnAppQuit`，包一层状态机 + IPC 推送 + 退出时取消下载

AI 评审部分见 [AI 评审闭环（Open-code-review）](/ai/review-loop)。

注意点：

- 不要绕过 `UpdaterService` 直接调 autoUpdater：channel、feedURL、取消下载、错误分类都挂在状态机上
