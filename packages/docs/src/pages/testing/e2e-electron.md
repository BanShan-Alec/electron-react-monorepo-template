# 端到端测试（Playwright）

## 要解决的坑

- E2E 要拉起真实窗口：Electron 冷启动慢、单例锁冲突、进程树残留，任何一项都能把 CI 拖挂

## 本仓库的解法

### 3. E2E 真实拉起 Electron：worker 级单次启动 + 隔离用户数据目录

→ 源码：[e2e/helpers/electron.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/e2e/helpers/electron.ts)

```ts
// 1. 准备隔离的用户数据目录（外部传入时复用，用于验证跨进程持久化）
const ownsUserDataDir = !options.userDataDir;
const tempUserDataDir =
  options.userDataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'electron-e2e-'));
const shouldCleanupUserData = options.cleanupUserData ?? ownsUserDataDir;

// 2. 启动 Electron 应用
const electronApp = await electron.launch({
  args: [
    '.',
    `--user-data-dir=${tempUserDataDir}`,
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    ...(options.extraArgs ?? []),
  ],
  env: {
    ...process.env,
    MODE: 'test',
    ...options.extraEnv,
  },
});

// 3. 将主进程日志重定向至控制台以便追踪诊断
const proc = electronApp.process();
proc.stdout?.pipe(process.stdout);
proc.stderr?.pipe(process.stderr);

// ……（源码第 4 步在此注入主进程 shell 安全桩，见下一节）

// 5. 等待应用首个窗口加载就绪
const page = await electronApp.firstWindow();
page.on('pageerror', (err) => console.error('PAGE ERROR:', err));
await page.waitForLoadState('domcontentloaded');
```

每次启动都建独立的临时 user-data-dir：规避 Electron 单例锁冲突；持久化类用例显式传入目录即可复用，测「同一 userData 重启恢复窗口」——目录是否随用例清理由 `shouldCleanupUserData` 决定，自建目录默认删除、外部传入默认保留。启动参数带 `--disable-gpu` 等降级项，`MODE=test` 注入测试环境。

（源码第 4 步的 shell 安全桩见[端到端断言策略（shell 打桩 + 容差）](/testing/e2e-assertions)。）

启动逻辑收敛成一个 worker 级夹具：

→ 源码：[e2e/helpers/fixture.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/e2e/helpers/fixture.ts)

```ts
export const test = base.extend<TestFixtures, WorkerFixtures>({
  electronCtx: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright fixtures require object destructuring pattern for dependency analysis
    async ({}, use) => {
      const ctx = await launchElectronApp();
      await use(ctx);
      await ctx.cleanup();
    },
    { scope: 'worker', auto: true },
  ],

  electronApp: [
    async ({ electronCtx }, use) => {
      await use(electronCtx.electronApp);
    },
    { scope: 'worker' },
  ],

  page: async ({ electronCtx }, use) => {
    // 复用已启动的 Electron 主窗口
    await use(electronCtx.page);
  },

  tempUserDataDir: async ({ electronCtx }, use) => {
    await use(electronCtx.tempUserDataDir);
  },
});
```

`scope: 'worker'` + `auto: true`：整个 Worker 生命周期只冷启动一次，用例直接拿现成的 `page` / `electronApp` / `tempUserDataDir`，全部跑完自动清理。清理函数对 `electronApp.close()` 加 5 秒限时，超时就跨平台强杀进程树并销毁 stdio 管道，进程残留不外泄。Playwright 侧配合强制串行：

→ 源码：[.config/playwright.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.config/playwright.config.ts)

```ts
fullyParallel: false,
workers: 1, // Electron E2E must run sequentially to avoid display/process lock conflicts
```

## 怎么抄

黑盒行为测试的接入步骤：

2. **黑盒行为**：在 `e2e/` 建 spec，`import { test, expect } from './helpers/fixture'` 直接拿 `page` / `electronApp` / `tempUserDataDir`；本地跑 `pnpm test:e2e:build`——E2E 以根 `package.json` 的 `main` 为入口，必须先产出各包构建产物（CI 的 e2e job 同样先 build 再测）

注意点：

- E2E 的 `workers: 1` 是硬约束——Electron 多实例并发会撞显示与进程锁，别为提速改并发
