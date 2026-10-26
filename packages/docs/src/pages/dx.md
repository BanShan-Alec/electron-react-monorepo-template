# 开发体验

一条 `pnpm start` 拉起渲染进程热更新、preload 与主进程 watch 构建和 Electron 窗口；端口冲突、单实例锁、远程调试、进程清理这些天天碰的琐事全部交给脚本。

## 收录的解法

- [开发编排（Vite + Electron 双进程）](/dx/dev-orchestration)：一条命令串起渲染 dev server、preload 与主进程 watch 构建，用 MODE 切换开发态与生产预览，退出时按进程树清场。
- [启动预检（单实例与端口）](/dx/startup-preflight)：起服务前先探测存量实例与端口占用，确认后定向清理，非 TTY 环境直接报错。
- [远程调试端口（CDP）](/dx/debug-port)：渲染进程 CDP 与主进程断点端口都是配置项，注释一行即关闭对应能力。
- [日志与链路排查（用法视角）](/dx/log-troubleshooting)：从诊断面板打开日志目录，用 traceId 把渲染层与主进程的日志串成一条链路。

## 建议阅读顺序

按启动顺序读最顺：[启动预检（单实例与端口）](/dx/startup-preflight) → [开发编排（Vite + Electron 双进程）](/dx/dev-orchestration) → [远程调试端口（CDP）](/dx/debug-port)；[日志与链路排查（用法视角）](/dx/log-troubleshooting) 可在排障时单独查阅。
