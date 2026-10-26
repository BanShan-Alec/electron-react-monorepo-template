# 托盘常驻与单实例（Tray + 单实例锁）

## 要解决的坑

用户双击图标就多开一个实例；点关闭按钮进程直接退出，后台正在跑的任务说没就没。

## 本仓库的解法

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

抢到锁的实例监听 `second-instance` 唤起主窗口（→ 源码：[packages/main/src/modules/window/index.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/window/index.module.ts)）：

```ts
electronApp.on('second-instance', () => handleReactivation());
```

「点关闭」不等于「退出」——关闭行为按配置分流：

```ts
browserWindow.on('close', () => {
  if (appLifecycle.isQuitting) {
    // ...
    return;
  }

  const configStore = getAppConfigStore();
  const shouldMinimizeToTray = configStore.get('minimizeToTray');

  if (shouldMinimizeToTray) {
    // 用户开启了关闭时最小化到托盘：允许窗口自然销毁以彻底释放内存，
    // 不拦截 close 事件（不 event.preventDefault()），亦不触发 app.quit()，
    // 应用进程继续保留系统托盘常驻。
    logger.info('Home window closed and destroyed -> running in tray');
  } else {
    // ...更新下载中退守后台 / 无后台任务则 app.quit()
  }
});
```

`minimizeToTray` 默认 `true`（→ 源码：[packages/shared/src/schemas/config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/schemas/config.ts)）；不拦截 close 事件而是让窗口自然销毁，内存彻底释放，比 `hide()` 常驻更干净。即便不开托盘常驻，更新正在下载时也会退守后台并弹系统通知，孤儿进程有 watchdog 收尾。

这项偏好的加载、校验与落盘见 [配置持久化（electron-store）](/main/config-persistence)。

托盘补上「复活入口」：单击唤起/重建主窗口，右键菜单双语（主进程用不了 Lingui，文案在 `updateLanguage` 里按 zh-CN 分支手写）：

→ 源码：[packages/main/src/modules/tray.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/tray.module.ts)

```ts
this.contextMenu = Menu.buildFromTemplate([
  {
    label: isZh ? '显示主窗口' : 'Show Main Window',
    click: () => this.restoreMainWindow(),
  },
  // ...检查更新菜单项
  { type: 'separator' },
  {
    label: isZh ? '退出应用' : 'Quit Application',
    click: () => {
      appLifecycle.isQuitting = true;
      app.quit();
    },
  },
]);
```

托盘图标在 win32 直接传 .ico 文件路径，让系统 `Shell_NotifyIcon` 按 DPI 阶梯自动选图——比 `nativeImage` 强行 resize 的插值模糊干净得多。「退出应用」菜单项先置 `appLifecycle.isQuitting = true` 再 quit，关闭分流的守卫据此放行，退出闭环不会互相打架。

## 怎么抄

桌面原型的注意点：新窗口记得进 window-registry 注册（托盘/单实例唤起都依赖它）；托盘菜单加项要同步 `updateLanguage` 的双语分支。
