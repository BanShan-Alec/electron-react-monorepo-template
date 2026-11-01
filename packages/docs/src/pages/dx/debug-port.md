---
title: 远程调试端口（CDP）
description: 渲染进程 CDP 与主进程断点端口都是配置项，注释一行即关闭对应能力。
---

# 远程调试端口（CDP）

> **TL;DR**：渲染进程 CDP 与主进程断点端口都是配置项，注释一行即关闭对应能力。

## 要解决的坑

- 想给渲染进程断点、看性能面板，得翻文档查 `--remote-debugging-port` 怎么传；想调主进程又得另找 `--inspect`

## 本仓库的解法

### 调试端口即配置：注释一行开关一个能力

→ 源码：[scripts/dev.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/dev.ts)

调试端口的开关不长在文档里，长在配置上。渲染进程 CDP 默认开启，主进程断点端口默认注释关闭：

```ts
const config: {
  mode: string;
  rendererPort: number;
  mainInspectPort?: number;
  rendererCdpPort?: number;
} = {
  mode: repoEnv.mode,
  rendererPort: 5173,

  // 按需注释:注释掉即关闭对应能力
  // mainInspectPort: 9229, // 主进程调试断点端口(--inspect-brk)
  rendererCdpPort: 9222, // 渲染进程 CDP 端口(--remote-debugging-port)
};
```

组装 Electron 启动参数时按需跳过，对应日志一起消失：

```ts
/** 组装 Electron 启动参数;对应端口被注释掉时自动跳过并关闭日志。 */
function buildElectronArgs(): string[] {
  const args: string[] = [];

  if (config.mainInspectPort) {
    args.push(`--inspect-brk=${config.mainInspectPort}`);
    console.log(`${LOG_PREFIX} main break inspect endpoint: http://127.0.0.1:${config.mainInspectPort}`);
  }

  if (config.rendererCdpPort) {
    args.push(`--remote-debugging-port=${config.rendererCdpPort}`);
    console.log(`${LOG_PREFIX} renderer CDP endpoint: http://127.0.0.1:${config.rendererCdpPort}`);
  }

  return args;
}
```

效果：`pnpm dev` 或 `pnpm preview` 起来后终端直接打印 CDP endpoint（日志前缀分别是 `[dev]` / `[preview]`），Chrome 打开 `chrome://inspect` 即可连接渲染进程断点、看 Performance 面板；要调主进程，取消 `mainInspectPort` 的注释即以 `--inspect-brk` 启动。注释掉一个属性，命令行参数、启动日志、开发态启动前的端口预检（[启动预检（Single-instance + Port）](/dx/startup-preflight) 里 `ensurePortsAvailable` 会自动过滤未配置端口）会一起联动，不存在第二处要同步的开关。
