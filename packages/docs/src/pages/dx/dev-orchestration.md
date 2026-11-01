---
title: 开发编排（Vite + Electron）
description: 开发态一条命令串起渲染 dev server、preload 与主进程 watch 构建；生产预览一条命令构建三包后启动 Electron，退出时按进程树清场。
---

# 开发编排（Vite + Electron）

> **TL;DR**：`pnpm dev` 串起渲染 dev server、preload 与主进程 watch 构建；`pnpm preview` 一次性构建三包后以生产形态启动。退出时都按进程树清场，`pnpm start` 是 `preview` 的别名。

## 要解决的坑

Electron 项目的开发回路天生比纯 Web 重：

- 一次开发要伺候四样东西：渲染进程 dev server、preload 构建、主进程构建、Electron 进程——手工开四个终端按顺序敲命令，改一次主进程还得手动重启应用
- Ctrl+C 关掉终端，Electron 子进程经常留在后台变僵尸，占着单实例锁和端口

这套脚本把整个回路收敛成两条命令：`pnpm dev` 进开发态，`pnpm preview` 构建后预览生产形态；启动前自动排障，退出后自动清场。

## 本仓库的解法

### 开发态：一条命令编排三路构建

→ 源码：[scripts/dev.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/dev.ts)

命令定义在根 [package.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/package.json) 里，`dev` 与 `preview` 各一行、只差 MODE；`start` 是 `preview` 的别名，与 electron-vite 模板保持一致：

```json
"dev": "cross-env MODE=development tsx scripts/dev.ts",
"preview": "cross-env MODE=production tsx scripts/dev.ts",
"start": "pnpm preview",
```

`scripts/dev.ts` 按 MODE 分流：`development` 走开发态编排，其余形态走生产预览。开发态顺序固定——先排障（见 [启动预检（Single-instance + Port）](/dx/startup-preflight)），再起服务，最后挂两个 watch 构建：

```ts
async function startDevServer(): Promise<void> {
  // 0. 单实例排查：打包版托盘常驻 / 旧 dev 实例持有单实例锁会让新实例直接退出，
  //    交互确认后终止；置于端口排查之前，dev-vs-dev 场景下对端 electron 被杀会连带
  //    其 dev 会话自行退出并释放端口，一次确认解决两件事
  await ensureNoAppInstanceRunning(ROOT_DIR);

  // 1. 启动前端口排查与定向释放
  await ensurePortsAvailable([
    { port: config.rendererPort, desc: 'Vite Renderer' },
    { port: config.rendererCdpPort, desc: 'Renderer CDP Debugging' },
    { port: config.mainInspectPort, desc: 'Main Inspect Break' },
  ]);

  // 2. Create and start Vite dev server for the renderer
  const rendererWatchServer = await startRendererDevServer();

  // 3. Build independent plugins from factories
  const preloadReloaderPlugin = createPreloadReloaderPlugin(rendererWatchServer);
  const electronLauncherPlugin = createElectronLauncherPlugin();

  // 4. Watch and build packages with their respective plugins
  // ...(preload 与 main 两个 watch 构建，分别挂上述两个插件)
}
```

dev server 必须用 Vite 的编程式 `createServer()` 而不是 CLI 起——拿到 `server.resolvedUrls` 才能把实际地址透传给主进程；`resolvedUrls` 是真实生效的监听地址，即使 Vite 因端口被占触发默认的端口顺延（本仓的启动前预检通常已把这一幕拦下），透传的也不会错：

```ts
await server.listen();

// 透传给主进程，设置渲染进程 dev-server 的 URL
if (server.resolvedUrls?.local?.[0]) {
  process.env.VITE_DEV_SERVER_URL = server.resolvedUrls.local[0];
}
```

三个包的重载粒度各不相同，插件按各自性质定制。渲染进程走 Vite 自带 HMR；preload 是 CJS 产物没有热更可言，重建完成后向渲染进程广播全量刷新：

```ts
function createPreloadReloaderPlugin(server: ViteDevServer): Plugin {
  return {
    name: '[dev]preload-dev-reloader',
    writeBundle() {
      server.ws.send({
        type: 'full-reload',
      });
    },
  };
}
```

主进程重建后重启整个 Electron，插件的 `writeBundle` 先杀旧进程树再拉新的：

```ts
async writeBundle() {
  /** Kill electron if a process already exists */
  if (electronApp !== null) {
    electronApp.removeListener('exit', process.exit);
    if (electronApp.pid) {
      await killProcessTree(electronApp.pid);
    } else {
      electronApp.kill('SIGINT');
    }
    electronApp = null;
  }

  /** Spawn a new electron process */
  const args = buildElectronArgs();

  // --remote-debugging-port 暴露 renderer CDP，供外部 CDP 客户端连接驱动
  electronApp = spawn(String(electronPath), [...args, '.'], { stdio: 'inherit' });

  /** Stops the watch script when the application has been quit */
  electronApp?.addListener('exit', process.exit);
},
```

开发态下改哪层就重载哪层：渲染层改动即时生效，preload 改动全量刷新，主进程改动重启应用——语义明确，不假装三样东西都能热更。

### 生产预览：一次性构建后启动

`pnpm preview` 不复用上面的 watch 骨架，而是「构建 → 启动 → 等退出」：

```ts
async function runPreview(): Promise<void> {
  const { skipBuild } = parsePreviewArgs();

  // 旧实例持有单实例锁会让新进程直接退出，窗口不出现也没有解释
  await ensureNoAppInstanceRunning(ROOT_DIR);

  if (!skipBuild) {
    // 只构建应用运行所需的三包；pnpm build 会连带构建 @app/docs，预览用不到
    execSync('pnpm -r --filter @app/main --filter @app/preload --filter @app/renderer run build', {
      stdio: 'inherit',
    });
  }

  const electronApp = spawn(String(electronPath), [...buildElectronArgs(), '.'], {
    stdio: 'inherit',
  });
  electronApp.on('exit', (code) => process.exit(code ?? 0));
}
```

几个刻意的取舍：

- **与 electron-vite 的 `preview` 同形**：先构建再启动；`pnpm preview -- --skip-build` 跳过构建直接启动现有产物，脚本不校验产物完整性。产物缺失时主进程会打印 `[Uncaught Exception] Cannot find module ...` 但**不会退出、也不创建窗口**，命令会一直挂住，需要手动终止——这是刻意的取舍：让缺失以真实运行错误暴露，而不是由脚本替它兜底
- **不起 renderer dev server、不做端口预检**：窗口加载 `file://` 下的 dist 产物，没有服务需要占端口；单实例排查仍然保留
- **没有 watch**：改代码要重新跑 `pnpm preview`。预览态验证的是「构建产物 + 生产行为」，不是开发热更
- **CDP / inspect 参数照常生效**：调试端口与形态无关，`config` 里的开关对两条路径同时有效

### MODE 一个变量切换开发态与生产预览

→ 源码：[packages/main/src/env.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/env.ts)

`dev` 与 `preview` 跑的是同一个 `scripts/dev.ts`，差别是 cross-env 注入的 `MODE` 以及随之选择的分支。主进程不问「dev server 在不在」，只认 MODE 的语义：

```ts
export const isDev: boolean = !isPackaged && !isTest && process.env.MODE !== 'production';

// ...

export const isProd: boolean = !isTest && (isPackaged || process.env.MODE === 'production');

export const devServerUrl: string | undefined =
  process.env.MODE === 'development' && process.env.VITE_DEV_SERVER_URL
    ? process.env.VITE_DEV_SERVER_URL
    : undefined;
```

入口按 `devServerUrl` 二选一：开发态加载 dev server 页面，否则解析到渲染层构建产物（`@app/renderer` 的 `main` 字段指向 `dist/src/entries/home/index.html`）：

→ 源码：[packages/main/src/index.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/index.ts)

```ts
windows: {
  home: devServer
    ? new URL('src/entries/home/index.html', devServer)
    : { path: require.resolve('@app/renderer') },
  updater: devServer
    ? new URL('src/entries/updater/index.html', devServer)
    : { path: require.resolve('@app/renderer/updater') },
},
```

于是 `pnpm preview` 就是一次不打包安装程序的生产形态预演：窗口走 `loadFile` 加载真实产物，`isProd` 为 true，核心运行行为与安装版对齐（`isPackaged` 仍为 false，updater 这类按打包形态分支的逻辑仍有差异，需显式 `setFeedURL`），提交前就能验证生产逻辑。`devServer` 还联动导航源白名单（`allowInternalOrigins`，拦截 `will-navigate` 的站外跳转）：开发态把当前 dev server 的 origin 加入放行集合，预览态回到 `file://`。

dev.ts 还给忘了注入 MODE 的情况留了兜底：缺失时归一为 `production`，主进程的 `isDev` / `isProd` 与窗口加载路径一并按生产语义走，不再出现「开发语义 + 加载 dist」的混合态：

```ts
if (!process.env.MODE) {
  console.warn('[dev] MODE not injected (expected via package.json cross-env), normalized to production');
  process.env.MODE = 'production';
}
```

### 退出即清场：信号与进程树

→ 源码：[scripts/dev.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/dev.ts) · [scripts/port-guard.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/port-guard.ts)

杀 Electron 主进程不会带走 renderer / GPU / utility 子进程——它们是独立 OS 进程，清理必须按树来。开发态的 launcher 插件挂载时注册终端退出信号，连带强杀整棵树：

```ts
// 监听终端退出信号，连带强杀 Electron 子进程树，防止僵尸进程退到后台托盘
const handleExitSignal = async () => {
  if (electronApp?.pid) {
    await killProcessTree(electronApp.pid);
    electronApp = null;
  }
  process.exit(0);
};
process.once('SIGINT', handleExitSignal);
process.once('SIGTERM', handleExitSignal);
```

preview 路径没有插件，由 `runPreview` 注册同一套信号处理；应用退出时命令以相同退出码结束（被信号终止时 `code` 为 `null`，按 0 退出）。

`killProcessTree` 跨平台实现，Windows 用 `taskkill /T /F` 递归强杀，POSIX 先给子进程发 TERM、再向进程组发 SIGKILL：

```ts
try {
  if (process.platform === 'win32') {
    execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
  } else {
    // 1. 尝试先向子进程发送终止信号 (POSIX 通用)
    try {
      execSync(`pkill -TERM -P ${pid}`, { stdio: 'ignore' });
    } catch {}
    // 2. 尝试向进程组发 SIGKILL，若非组长进程则直接杀目标进程
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      process.kill(pid, 'SIGKILL');
    }
  }
} catch {}
```

这把锤子在四处复用：开发态与生产预览的终端退出信号清场、主进程重建时杀旧实例（「开发态」小节的 `writeBundle`）、端口与实例预检时杀占用者（[启动预检（Single-instance + Port）](/dx/startup-preflight)）。反方向也照顾到了——用户正常退出应用时，watch 脚本跟着结束，不留一个空转的终端：

```ts
/** Stops the watch script when the application has been quit */
electronApp?.addListener('exit', process.exit);
```

## 怎么抄

以「把这套开发回路搬进新仓库」为例，五步：

1. **package.json 挂命令**：`dev` / `preview` 各一行，内容只差 `cross-env MODE=...`；`start` 作为 `preview` 的别名，和 electron-vite 模板对齐
2. **开发态编排**：先预检（单实例 → 端口），再用编程式 `createServer()` 起渲染进程 dev server 并把 `resolvedUrls` 注入 `process.env.VITE_DEV_SERVER_URL`，最后 preload / main 两个 `build({ watch })` 各挂插件
3. **生产预览**：`pnpm -r --filter ... run build` 只构建应用运行所需的三包（避开文档站），`--skip-build` 时跳过构建、直接启动现有产物；启动 Electron 后等应用退出，不做端口预检
4. **主进程消费 MODE**：集中一个 env 模块提供 `isDev` / `isProd` / `devServerUrl`，入口按 `devServerUrl` 决定加载 dev server 还是渲染层产物
5. **清场**：launcher 插件与 `runPreview` 各自持有 Electron 进程句柄，`SIGINT` / `SIGTERM` 时杀树；`killProcessTree` 按 Windows / POSIX 分平台实现

注意点：

- dev server 必须用编程式 `createServer()` 而不是 CLI 起——要拿 `server.resolvedUrls` 透传给主进程，也借此拿到 server 实例向 preload 插件广播全量刷新
- preview 不要复用开发态的 watch 骨架：一次性构建才能保证窗口里是最新产物，`--skip-build` 也必须先校验产物
- 清理必须杀进程树而不是单个 PID：只杀主进程会留下 renderer / GPU 子进程继续占锁占端口
