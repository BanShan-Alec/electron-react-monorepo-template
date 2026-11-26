---

title: 托盘常驻、单实例与开机自启（Tray + Single-instance + Auto-launch）
description: 单实例锁防多开与二次唤起，关闭分流串联首次询问与自然销毁，原生托盘菜单与开机自启全链路。
---

# 托盘常驻、单实例与开机自启（Tray + Single-instance + Auto-launch）

> **TL;DR**：主进程通过 `requestSingleInstanceLock()` 拦截重复启动，`HomeWindowModule` 监听 `second-instance` 唤醒现有窗口；点击关闭先判 `isQuitting` 与首次询问，确认后退守托盘自然销毁窗口释放内存；开机自启仅对安装版副本开放，按 `--hidden` / `login-item` 与 `minimizeToTray` 协同决定启动后是否静默入盘。

## 1. 选型理由

桌面客户端具有常驻与后台伴随特性：
1. **多实例冲突**：多次双击图标拉起独立进程，会争抢本地配置文件或调试端口。
2. **伪常驻内存膨胀**：关闭窗口时仅调用 `win.hide()`，Chromium DOM 树与渲染进程内存依然常驻后台。
3. **开机自启与副本冲突**：工具类客户端常随系统登录静默入盘启动，而免安装副本与安装版共用同一 AppUserModelId（AUMID），若不收口写权限会导致测试副本覆盖安装版登录项。

工程通过「单实例抢锁 + `second-instance` 唤起 + 关闭自然销毁 + 安装版专属开机自启」实现轻量后台常驻。

→ 官方文档：[Electron app.requestSingleInstanceLock](https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelockadditionaldata)（读它能了解单实例锁、`second-instance` 唤醒时序以及与 `Tray` 常驻协同的多平台差异）。

## 2. 核心机制

```mermaid
flowchart TB
  Boot["系统登录自启（Win --hidden / macOS login-item）<br/>或用户手动启动"] --> Lock{"SingleInstanceApp<br/>requestSingleInstanceLock()"}
  Lock -->|失败| Exit["warn + app.quit() + process.exit(0)"]
  Lock -->|成功| Hidden{"自启拉起 且 minimizeToTray?"}
  Hidden -->|是| SilentTray["跳过建窗，直接驻留托盘<br/>+ checkStartupStatus() 校验"]
  Hidden -->|否| ShowHome["restoreOrCreateWindow(true)<br/>+ 监听 second-instance / activate"]
  Close["点击主窗口关闭"] --> Quitting{"appLifecycle.isQuitting?"}
  Quitting -->|是| Destroy["直接放行销毁"]
  Quitting -->|否| Confirmed{"closeBehaviorConfirmed?"}
  Confirmed -->|否| Ask["preventDefault + 发 WINDOW_CLOSE_REQUESTED<br/>见 /ui/close-confirmation"]
  Confirmed -->|是| TrayCfg{"minimizeToTray?"}
  TrayCfg -->|是| KeepTray["不阻止 close 自然销毁<br/>window-all-closed 拦截退出留守托盘"]
  TrayCfg -->|否| CancelQuit["preventDefault + quitAfterCancellingUpdate()"]
  Tray["点击托盘 / 退出"] --> Restore["restoreMainWindow() 重建或显示"]
  Tray --> QuitMenu["isQuitting = true; app.quit()"]
```

### 单实例互斥与对端唤醒

`SingleInstanceApp` 只负责抢锁，抢不到立即告警并退出；占有锁的实例由 `HomeWindowModule.enable()` 监听 `second-instance` 与 macOS `activate`，调用 `restoreOrCreateWindow(true)` 唤醒或重建主窗口（[home-window.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/window/home-window.module.ts)）。

→ 源码：[packages/main/src/modules/single-instance.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/single-instance.module.ts)

```ts
export class SingleInstanceApp implements AppModule {
  enable({ app }: { app: Electron.App }): void {
    const isSingleInstance = app.requestSingleInstanceLock();
    if (!isSingleInstance) {
      // 抢锁失败最常见成因：上一实例关闭主窗口后退守托盘、仍持有锁。
      // 一条 log.warn 同时落盘 main.log 并经控制台 transport 回显到终端
      const message =
        'Cannot acquire single instance lock: another instance is running (check the tray icon). Exiting.';
      getLogManager().scoped(this).warn(message);
      app.quit();
      process.exit(0);
    }
  }
}
```

### 关闭分流：首次询问、自然销毁与退出

点击主窗口关闭按钮按四级分支流转：处于退出流程直接放行；`closeGuardBypass` 为假且未完成首次确认时，阻止关闭并向渲染端发送 `WINDOW_CLOSE_REQUESTED`（渲染端弹窗与回传逻辑见 [首次关闭确认](/ui/close-confirmation)）；已确认且 `minimizeToTray` 为真时不调用 `preventDefault()`，让窗口自然销毁释放内存，由 [auto-terminate.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/auto-terminate.module.ts) 在 `window-all-closed` 留守托盘；否则先取消在途更新再退出。

→ 源码：[packages/main/src/modules/window/home-window.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/window/home-window.module.ts)

```ts
// 节选：HomeWindowModule 主窗口 close 事件四级分流
browserWindow.on('close', (event) => {
  if (appLifecycle.isQuitting) {
    this.closeRequestPending = false;
    return;
  }
  if (this.closeGuardBypass) {
    this.closeGuardBypass = false;
  } else if (!getAppConfigStore().get('closeBehaviorConfirmed')) {
    event.preventDefault();
    this.closeRequestPending = true;
    sendToWindow(WINDOW_IDS.HOME, IPC_CHANNELS.WINDOW_CLOSE_REQUESTED, null);
    return;
  }
  const shouldMinimizeToTray = getAppConfigStore().get('minimizeToTray');
  if (shouldMinimizeToTray) {
    logger.info('Home window closed and destroyed -> running in tray');
  } else {
    event.preventDefault();
    if (!this.quitAfterCancelPending) {
      this.quitAfterCancelPending = true;
      void this.quitAfterCancellingUpdate();
    }
  }
});
```

### 托盘菜单原生多语言与退出防护

托盘菜单文案由轻量函数 `mainMessage(lang, key)` 驱动，退出前必须先置位 `appLifecycle.isQuitting = true`：

→ 源码：[packages/main/src/modules/tray.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/tray.module.ts)

```ts
// 节选：TrayManager.updateLanguage 托盘菜单模板与显式退出标记
this.contextMenu = Menu.buildFromTemplate([
  {
    label: mainMessage(lang, 'trayShowMainWindow'),
    click: () => this.restoreMainWindow(),
  },
  {
    label: mainMessage(lang, 'trayCheckUpdates'),
    click: () => {
      this.logger.info('User requested update check');
      updaterService.check().catch((err) => {
        this.logger.warn('Failed to check for updates from tray:', err);
      });
      getUpdaterWindowModule()
        .show()
        .catch((err) => {
          this.logger.error('Failed to show updater window from tray:', err);
        });
    },
  },
  { type: 'separator' },
  {
    label: mainMessage(lang, 'trayQuit'),
    click: () => {
      appLifecycle.isQuitting = true;
      app.quit();
    },
  },
]);
```

### 开机自启：启动顺序、失效场景与注意事项

系统登录项通过 `app.setLoginItemSettings` 注册，并受副本资格、启动参数与系统侧拦截状态约束：

1. **启动顺序**：用户打开自启开关时，`ConfigService.updateConfig()` 先调用 `autoLaunchService.setAutoLaunch(true)` 写登录项（失败直接阻断落盘；`resetConfig()` 清除失败则仅记 warn 降级继续）→ 系统开机拉起应用（Win 附带 `args: ['--hidden']`，macOS 通过 `wasOpenedAtLogin` 识别）→ `SingleInstanceApp` 抢锁 → `HomeWindowModule.enable()` 判定 `shouldStartHidden`（仅在 `minimizeToTray === true` 时跳过建窗直接驻留托盘；若关闭了托盘驻留则照常显示主窗口，防无窗无托盘幽灵进程）→ `initApp()` 模块就绪后调用 `autoLaunchService.checkStartupStatus()` 静默核验系统状态。
2. **什么情况会失效或不可用**：
   - **平台或副本资格不符**：非 `win32`/`darwin`（`platform`）、未打包开发/预览态（`source-run`）、或位于构建仓库内的免安装副本（`unpacked-copy`，依 `__BUILD_REPO_ROOT__` 与 `path.relative` 判定，防覆盖同 AUMID 的安装版登录项；仅旧产物缺失该常量时降级放行）。
   - **配置开启但被系统侧拦截（`isBlockedBySystem`）**：登录项被系统设置/清理工具移除（`!openAtLogin`）、Windows 任务管理器禁用（`executableWillLaunchAtLogin === false`）、或 macOS 登录项待用户授权（`requires-approval`）。
3. **需要注意什么**：联调 `pnpm build:unpack` 或 `dist/win-unpacked` 时设置页自启开关置灰属保护行为，验证真实登录项需用安装版（`Program Files` / `Applications`）。

| 可执行文件位置                                   | 判定              | 结果               |
| :----------------------------------------------- | :---------------- | :----------------- |
| `pnpm build:unpack` / `dist/win-unpacked`        | 仓库内 → 就地副本 | 拒绝读写，开关置灰 |
| 安装到 `Program Files` / `Applications` / `/opt` | 仓库外 → 安装版   | 正常管理开机自启   |

→ 源码：[packages/main/src/services/auto-launch.service.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/services/auto-launch.service.ts)

## 3. 桌面端避坑注意事项

- **托盘常驻切勿滥用 `win.hide()`**：
  - 允许窗口自然销毁可释放 Chromium 渲染进程与 GPU 显存；再次点击托盘或二次启动时通过 `restoreOrCreateWindow(true)` 重建窗口即可。
- **退出应用必须先置位 `appLifecycle.isQuitting = true`**：
  - 托盘「退出应用」菜单项必须先设置该标记再 `app.quit()`，避免再次被 `close` 拦截或留在托盘。
- **Windows 托盘图标直传 `.ico` 文件路径**：
  - Windows 向 `new Tray(iconPath)` 传入含多尺寸 DPI 的 `.ico` 路径，由系统按缩放比选图；macOS 保留全彩图标（不设 template image）并 `resize` 至 16×16。
- **开机自启不要交给免安装副本**：
  - 在 `dist/win-unpacked` 联调时自启开关会提示就地副本不可管理；验证系统登录项需使用真实安装包。
- **页面职责边界**：
  - **本页负责**：主进程单实例抢锁与唤醒、窗口关闭分流、托盘菜单与开机自启全链路。
  - **本页不负责**：首次关闭确认的渲染端弹窗与状态回传见 [首次关闭确认](/ui/close-confirmation)；开发态 CLI 单实例与端口预检见 [启动预检](/dx/startup-preflight)；配置持久化机制见 [配置持久化](/main/config-persistence)。
