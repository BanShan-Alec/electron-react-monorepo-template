---
title: 启动预检（Single-instance + Port）
description: 起服务前先探测存量实例与端口占用，确认后定向清理，非 TTY 环境直接报错。
---

# 启动预检（Single-instance + Port）

> **TL;DR**：起服务前先探测存量实例与端口占用，确认后定向清理，非 TTY 环境直接报错。

## 要解决的坑

- 上一个实例没退干净（打包版托盘常驻、上次的 dev 会话），新实例被单实例锁直接顶掉，窗口没弹出来却看不出原因；端口也可能被残留进程占着

## 本仓库的解法

### 启动前预检：先单实例锁，后端口占用

→ 源码：[scripts/instance-guard.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/instance-guard.ts) · [scripts/port-guard.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/port-guard.ts)

Electron 应用带单实例锁：打包版托盘常驻、或上一次 dev 会话没退干净时，新实例会被静默顶掉。所以编排第一步不是起服务，而是先探测存量实例。Windows 下按产品名匹配打包版；dev 实例按可执行文件路径锚定在本仓 `node_modules` 下，避免误杀其他项目 / 其他 worktree 的 electron。POSIX 侧同理，模式就两项：

```ts
const patterns = [`${repoRoot}/node_modules/electron/dist/electron`, APP_IDENTITY.productName];
```

端口排查走同一套交互契约——找到占用进程后问一声，经确认才杀：

```ts
export async function ensureSinglePortAvailable(port: number, desc: string): Promise<void> {
  const pid = await findOccupyingPid(port);
  if (pid === null || pid === process.pid) {
    return;
  }

  const procName = await getProcessName(pid);
  const shouldKill = await promptUserToKill(port, desc, pid, procName);

  if (shouldKill) {
    console.log(`[dev] 正在终止进程 ${procName} (PID: ${pid}) 及其子进程树...`);
    await killProcessTree(pid);
    // 等待 300ms 确保系统彻底释放套接字
    await new Promise((resolve) => setTimeout(resolve, 300));
    console.log(`\x1b[32m[dev] 端口 ${port} (${desc}) 已成功释放。\x1b[0m`);
  } else {
    console.log('[dev] 用户取消了端口释放，服务启动终止。');
    process.exit(1);
  }
}
```

占用进程的 PID 探测按平台取最稳的工具，且层层降级：Windows 用 `netstat -ano` 解析 `LISTENING` 行；POSIX 优先 `lsof`，缺失时降级 `ss`、再降级 `fuser`：

```ts
// POSIX: 优先使用 lsof（macOS 标配及大部分 Linux 系统）
try {
  const output = execSync(`lsof -i :${port} -t -sTCP:LISTEN`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  if (output) {
    const pid = Number.parseInt(output.split('\n')[0], 10);
    if (!Number.isNaN(pid) && pid > 0) return pid;
  }
} catch {
  // ...(lsof 缺失时降级 ss → fuser，见源码)
}
```

两个细节值得抄走：

- **非 TTY 直接抛错**（CI 里等不了交互确认），消息里给出进程名、PID 和人工处理指引，绝不挂起：

```ts
if (!process.stdin.isTTY) {
  throw new Error(
    `[dev] 端口 ${port} (${desc}) 正被 ${procName} (PID: ${pid}) 占用。在非交互式环境 (Non-TTY) 下无法等待确认，请先终止该进程或释放端口。`,
  );
}
```

- **杀完复检**：实例清理后重新探测一遍，仍有幸存者就红字警告「本次启动可能抢锁失败」——不假装清理成功。

## 怎么抄

注意点：

- 预检顺序固定「单实例 → 端口」：dev-vs-dev 场景下杀掉对端 electron 会连带其 dev 会话退出并释放端口，一次确认解决两件事
- 端口预检只在开发态执行：`pnpm preview` 一次性构建后直接启动 Electron、不监听 dev server，因此只做单实例排查
- 非 TTY 环境（CI）等不了交互确认，探测到冲突直接抛错并给出人工处理指引
- Windows 下启动先 `chcp 65001` 切 UTF-8，避免 Git Bash 等终端中文日志乱码；探测脚本向 PowerShell 传参走环境变量，绕开路径与产品名的引号转义
- 脚本一律经 `findRepoRoot` 向上锁定仓库根，不依赖 `process.cwd()`——桌面快捷方式 / CI 的工作目录偏移带不偏路径
