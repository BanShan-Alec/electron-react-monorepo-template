---

title: 托盘常驻与单实例（Tray + Single-instance）
description: 单实例锁防多开与二次唤起，关闭窗口自然销毁退守托盘，原生菜单多语言映射。
---

# 托盘常驻与单实例（Tray + Single-instance）

> **TL;DR**：主进程通过 `requestSingleInstanceLock()` 拦截应用重复启动，二次点击直接激活并唤醒现有窗口；点击关闭按钮分流为“退守托盘常驻（自然销毁窗口释放内存）”；开机自启按 AUMID 归属，只有安装到系统位置的副本才能写登录项。

## 1. 选型理由

桌面客户端具有常驻与后台伴随特性：
1. **多实例冲突**：用户多次双击桌面图标会拉起多个相互独立的实例，互相争抢本地数据库或端口，造成数据覆写。
2. **内存泄露伪常驻**：传统做法在关闭窗口时调用 `win.hide()`，虽然界面隐藏了，但 Chromium 的 DOM 树与庞大渲染进程内存依然完全留在后台，越积越大。

工程通过“单实例抢锁唤起”与“退守托盘时自然销毁窗口”实现极致的内存控制。

## 2. 核心机制

### 单实例互斥与对端唤醒

→ 源码：[packages/main/src/modules/single-instance.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/single-instance.module.ts)

```ts
export class SingleInstanceApp implements AppModule {
  enable({ app }: ModuleContext): void {
    const isSingleInstance = app.requestSingleInstanceLock();
    if (!isSingleInstance) {
      // 抢锁失败：已有实例在运行（可能在后台托盘常驻），记录日志并瞬间退出
      getLogManager()
        .scoped(this)
        .warn('Cannot acquire single instance lock: another instance is running. Exiting.');
      app.quit();
      process.exit(0);
    }
  }
}

// 占有锁的初次实例：监听 second-instance 信号，重新激活主窗口
electronApp.on('second-instance', () => {
  restoreOrCreateWindow(true);
});
```

### 关闭分流与自然销毁（彻底释放内存）

→ 源码：[packages/main/src/modules/window/home-window.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/window/home-window.module.ts)

```ts
browserWindow.on('close', (event) => {
  if (appLifecycle.isQuitting) return;

  const shouldMinimizeToTray = getAppConfigStore().get('minimizeToTray');
  if (shouldMinimizeToTray) {
    // 不拦截 close 事件（不调用 preventDefault），允许窗口自然销毁以释放渲染内存，
    // 应用进程依托 Tray 模块继续在系统托盘存活。
    logger.info('Home window closed and destroyed -> running in tray');
  }
});
```

### 托盘菜单原生多语言与退出防护

托盘菜单文案由轻量函数 `mainMessage(lang, key)` 驱动，退出时先置位生命周期标记再退出：

→ 源码：[packages/main/src/modules/tray.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/tray.module.ts)

```ts
this.contextMenu = Menu.buildFromTemplate([
  { label: mainMessage(lang, 'trayShowMainWindow'), click: () => this.restoreMainWindow() },
  { label: mainMessage(lang, 'trayCheckUpdates'), click: () => updaterService.check() },
  { type: 'separator' },
  {
    label: mainMessage(lang, 'trayQuit'),
    click: () => {
      appLifecycle.isQuitting = true; // 声明处于显式退出流程，防止窗口 close 拦截产生死锁
      app.quit();
    },
  },
]);
```

### 开机自启的系统登录项归属

Windows 的登录启动项按 AppUserModelId（AUMID）命名，落在 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`：**一个应用身份只有一条值**。安装版与解包目录里的免安装副本共用同一个 `appId`，因此共用 AUMID 与 `userData`——副本写一次启动项就直接覆盖安装版那一条，随后安装版因单实例锁抢不到而启动即退出（即上一节的机制在此处的后果）。

因此 `AutoLaunchService` 在写系统登录项前先判定副本资格，判据是构建期注入主进程 bundle 的仓库根目录 `__BUILD_REPO_ROOT__`（渲染层拿不到该常量）：

| 可执行文件位置                                   | 判定              | 结果                                |
| :----------------------------------------------- | :---------------- | :---------------------------------- |
| `pnpm build:unpack` 产物                         | 仓库内 → 就地副本 | 拒绝读写，开关置灰                  |
| `pnpm build:win` 遗留的 `dist/win-unpacked`      | 仓库内 → 就地副本 | 同样拒绝（`--skip-build` 不会串味） |
| 安装到 `Program Files` / `Applications` / `/opt` | 仓库外 → 安装版   | 正常管理开机自启                    |

不扫盘（不依赖卸载器文件名是否被清理）、不读注册表。不可管理时 `getAutoLaunchStatus()` 返回 `isSupported: false` 并带 `unsupportedReason`：`platform`（平台无登录项 API）、`source-run`（`pnpm dev` / `preview` 源码运行）、`unpacked-copy`（解包目录副本）；读写均降级为空操作且不抛错，设置页按原因给出对应文案。构建期标识缺失（旧产物或打包配置出错）时放行并记一次 warn，避免无法判定时集体禁用自启。

→ 源码：[packages/main/src/services/auto-launch.service.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/services/auto-launch.service.ts)

## 3. 桌面端避坑注意事项

- **托盘常驻切勿滥用 `win.hide()`**：
  - 允许窗口自然触发 `destroy` 可以彻底回收 Chromium 渲染管线、GPU 显存和 WebContext；用户再次点击托盘时重新创建窗口（由启动协调器毫秒级唤起），是长效常驻应用的正确解法。
- **退出应用必须防循环死锁**：
  - 从托盘点击“退出应用”时，必须先将全局标记置为 `appLifecycle.isQuitting = true`。如果未做标记，窗口销毁时再次触发 `on('close')` 拦截，将导致应用永远无法退出。
- **Windows 托盘图标直传 `.ico` 文件路径**：
  - 在 Windows 平台向 `new Tray(iconPath)` 传入原生 `.ico` 绝对路径，系统通知栏会按用户显示缩放（100%、125%、150%）自动选择最匹配的矢量尺寸，切勿使用 `nativeImage.resize()` 强转，否则会出现严重的马赛克模糊。
- **开机自启不要交给免安装副本**：
  - 解包目录里的副本与安装版共用 AUMID 与 `userData`，写入会覆盖安装版的启动项。联调期在 `dist/win-unpacked` 里拨开关不会有任何系统效果（判定为就地副本）；要验证自启行为，请装一个真实安装包再操作。
