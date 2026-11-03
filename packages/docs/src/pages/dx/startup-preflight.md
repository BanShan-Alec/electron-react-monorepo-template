---
title: 启动预检（Single-instance + Port）
description: 启动服务前先探测单实例锁与端口冲突，交互确认后定向清理，非 TTY 环境快速报错。
---

# 启动预检（Single-instance + Port）

> **TL;DR**：执行 `pnpm dev` 时，先探测后台残留的 Electron 实例（打包版或旧 dev 会话），再检测 Vite 与调试端口占用；检测到冲突后交互式提示强杀释放，非 TTY 环境直接阻断报错。

## 1. 选型理由

Electron 开发者常遇到两种极为隐蔽的“假死”现象：
1. **单实例锁静默退出**：如果上一次的开发会话未退出干净，或者后台托盘常驻着已打包的应用，新拉起的实例因申请单实例锁失败会瞬间自行退出。终端无报错、窗口无弹出，开发者往往误以为是构建闪退。
2. **端口占用与顺延迷航**：Vite 默认会自动顺延端口（如 5173 被占则自动改用 5174），但如果未被主进程获知，主进程窗口仍然试图连接旧地址，导致白屏超时。

## 2. 核心配置代码

### 预检执行序列与实例探测

→ 源码：[scripts/instance-guard.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/instance-guard.ts)

Windows 端按产品名称匹配，开发态实例则按当前工作区的绝对路径特征精准过滤，避免误杀机器上运行的其他项目：

```ts
const patterns = [
  `${repoRoot}/node_modules/electron/dist/electron`,
  APP_IDENTITY.productName,
];
```

### 跨平台端口占用探测与降级

→ 源码：[scripts/port-guard.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/port-guard.ts)

```ts
export async function ensureSinglePortAvailable(port: number, desc: string): Promise<void> {
  const pid = await findOccupyingPid(port);
  if (!pid || pid === process.pid) return;

  const procName = await getProcessName(pid);
  const shouldKill = await promptUserToKill(port, desc, pid, procName);

  if (shouldKill) {
    await killProcessTree(pid);
    await new Promise((resolve) => setTimeout(resolve, 300));
    console.log(`[dev] 端口 ${port} (${desc}) 已成功释放。`);
  } else {
    console.log('[dev] 用户取消了端口释放，启动终止。');
    process.exit(1);
  }
}
```

- Windows 下调用 `netstat -ano` 解析 `LISTENING` 行获取 PID。
- POSIX 下按 `lsof -i :port` ➔ `ss -tulpn` ➔ `fuser` 逐级降级探测。

### 非 TTY 自动化环境防挂起

在 CI 或自动化测试等无输入终端的环境中，禁止挂起等待输入：

```ts
if (!process.stdin.isTTY) {
  throw new Error(`[dev] 端口 ${port} (${desc}) 被 PID ${pid} 占用，Non-TTY 环境下无法等待确认，请先释放。`);
}
```

## 3. 桌面端避坑注意事项

- **预检时序必须是「先单实例，后端口」**：
  - 如果上次的 dev 会话残留在后台，强杀对端 Electron 实例通常会连带导致其父级 dev 进程自动退出，从而顺带释放 5173 等端口。颠倒顺序会导致用户经历两次不必要的二次确认。
- **Preview 模式下无需预检端口**：
  - `pnpm preview` 不需要启动 Vite Dev Server，直接加载本地 `file://`，因此预览模式只运行单实例探测，不浪费时间做端口预检。
- **清理后二次复检**：
  - 进程树强杀后，脚本会复查目标端口是否彻底归还操作系统。若残留进程拥有高权限无法强杀，会给出醒目的手动终止警告，不假装清理成功。
