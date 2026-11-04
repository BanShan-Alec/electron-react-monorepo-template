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

## 2. 核心机制

`UpdaterService` 用一份 `UpdaterSnapshot` 快照承载全部更新状态，7 个状态由 `@app/shared` 的 `updaterStateSchema` 统一定义（即 `UpdaterState` 的 7 个取值）；每次状态变更都经 `emitState()` 推送到更新窗口，渲染层只负责展示。

```mermaid
stateDiagram-v2
    state "主进程 UpdaterService" as MainProcess {
        state "空闲（idle）" as idle
        state "检查中（checking）" as checking
        state "有可用更新（available）" as available
        state "下载中（downloading）" as downloading
        state "已下载（downloaded）" as downloaded
        state "已是最新（up-to-date）" as upToDate
        state "错误（error）" as error

        [*] --> idle
        idle --> checking: check() / checkSilently()
        checking --> available: update-available
        checking --> upToDate: update-not-available
        checking --> error: 检查失败或超时
        available --> downloading: download()
        downloading --> downloaded: update-downloaded
        downloading --> available: cancel() 取消
        downloading --> error: 下载失败
        error --> downloading: 重试下载
        error --> checking: 重试检查
        downloaded --> [*]: install() 触发 quitAndInstall

        note right of downloading
            退出分支：quitAfterCancellingUpdate()
            先 await cancel()（2s 超时兜底），再 app.quit()
        end note
    }
```

→ 源码：[packages/shared/src/schemas/updater.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/schemas/updater.ts) · [packages/main/src/services/updater.service.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/services/updater.service.ts)

初始化阶段显式关闭官方默认行为：`autoDownload = false`、`autoInstallOnAppQuit = false`，并开启 `fullChangelog`（`updater.service.ts:188`）。入口方法各自带状态守卫：`check()` 在 `checking` / `downloading` 态直接抛 `UPDATER_ALREADY_RUNNING`（:319），`download()` 只接受 `available` 或 `error` 态（:460），`install()` 只接受 `downloaded` 态（:554）。因此安装永远需要用户在更新窗口里显式确认。

### 关键实现：取消下载

`cancel()` 是取消分支的唯一入口：渲染层经 IPC `updater:cancel` 调用；主窗口关闭并触发退出时，`quitAfterCancellingUpdate()` 会先 `await` 它（2 秒超时兜底），销毁更新窗口后再 `app.quit()`。

**节选**：`UpdaterService.cancel()`（`packages/main/src/services/updater.service.ts:524`）

```ts
public async cancel(): Promise<UpdaterSnapshot> {
  this.clearDevSimulationTimer();

  if (this.snapshot.state === 'downloading') {
    if (this.cancellationToken) {
      try {
        this.cancellationToken.cancel();
      } catch (err) {
        this.logger.warn('Failed to cancel token:', err);
      }
      this.cancellationToken = null;
    }
    this.snapshot.state = 'available';
    this.snapshot.progress = null;
    this.snapshot.error = null;
    this.snapshot.code = null;
    this.emitState();

    // 主窗口已不存在且未开启托盘常驻时，取消下载后退出，避免无界面进程残留
    const homeWin = getWindow(WINDOW_IDS.HOME);
    const shouldMinimizeToTray = getAppConfigStore().get('minimizeToTray');
    if (!shouldMinimizeToTray && (!homeWin || homeWin.isDestroyed())) {
      this.logger.info('Download cancelled with no window and tray disabled, quitting app');
      app.quit();
    }
  }
  return this.getSnapshot();
}
```

→ 源码：[packages/main/src/services/updater.service.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/services/updater.service.ts)

取消后状态退回 `available` 而不是 `idle`，用户可以重新发起下载；退出流程最多等待取消 2 秒，随后继续关闭进程。若取消时主窗口已销毁且未开启托盘常驻，`cancel()` 内部会直接 `app.quit()`，避免留下无界面进程（`updater.service.ts:542`）。

安装环节同理：用户在更新窗口确认后，`install()` 校验 `downloaded` 态并调用 `updater.quitAndInstall(false, true)`（`updater.service.ts:570`），进程退出后由安装器接管，全程没有静默强装。

## 3. 桌面端避坑注意事项

| 避坑要点                     | 事故表现与原因                                                                                                    | 本仓库对齐方案                                                                                                                          |
| :--------------------------- | :---------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| **退出应用被文件锁卡死**     | 用户正在下载 200MB 安装包时突然关闭应用，未关闭的下载任务持有本地临时文件句柄，导致下次启动安装包损坏或进程挂起。 | 主窗口关闭且未开启托盘常驻时，进入 `quitAfterCancellingUpdate()`，先 `await cancel()` 取消未完成的流（2 秒超时兜底），再 `app.quit()`。 |
| **源码/开发模式更新报错**    | 在 `pnpm dev` 下执行检查更新，由于未打包状态下缺少 `resources/app-update.yml`，导致程序直接抛出未捕获异常。       | 在开发态自动拦截并使用本地 Mock 逻辑，生产态基于 `package.json` 的 `repository.url` 自动合成更新源。                                    |
| **高频 Progress 冲垮渲染层** | 宽带极速下载时，`download-progress` 事件每秒触发数百次，频繁触发 IPC 序列化与 React 重新渲染致使界面卡死。        | 在主进程内部引入 `PROGRESS_EMIT_THROTTLE_MS`（节流阀，值为 250ms），将推送频率严格限制在每 250ms 一次。                                 |
| **错误分类与语义提示缺失**   | 报错仅显示 `Error: net::ERR_CONNECTION_TIMED_OUT` 等底层原始堆栈，用户无法理解。                                  | 通过 `classifyUpdaterError` 将网络超时、哈希校验失败、文件占用等异常映射为结构化 `ErrorCode` 并附带友好中文提示。                       |
