# 自动更新窗口（Updater Window）功能 Spec

> 版本：v2（已评审，已补齐 E2E / i18n / Theme / Tray / 防僵尸退出机制）　|　状态：设计定稿，待实现
> 关联：`packages/renderer/README.md`（分层规范）、`packages/shared/src/types/result.ts`（Result 契约）、`.config/playwright.config.ts`（E2E 测试配置）

## 0. 决策记录

| # | 决策 | 理由 |
| --- | --- | --- |
| D1 | 采用**方案 A：双入口**。`index.html` / `updater.html` 两个 Vite 入口，壳层件收敛到 `components/layout/AppProviders.tsx`，窗口根即 `features/updater/index.tsx` | 窗口身份显式；更新窗口只加载自己的小 bundle，与主界面解耦；不在 renderer src 引入新顶层目录 |
| D2 | 新增窗口身份定义：**`home` = 原主窗口（更名）**，`updater` = 更新窗口 | 原 "main window" 是隐语义；有了第二个窗口后必须显式命名，才能写清 restore / 广播 / 生命周期规则 |
| D3 | main 包内三层单向依赖：`services/updater.service.ts`（唯一与 electron-updater 对话）→ `modules/window/updater-window.module.ts`（唯一与 BrowserWindow 对话）→ `controllers/updater.controller.ts`（IPC 边界） | 与现有 controller/service 分层一致，窗口逻辑不被服务污染 |
| D4 | 事件推送走 preload `onXxx(cb) → unsubscribe` 约定 | 现有 `apiBridge` 全是 invoke，本功能首次引入推送；约定一次，后续复用 |
| D5 | home 侧手动入口**不新建 feature**，写进现有 `features/settings` 域 | README「Feature 规范 5」第二个消费者规则 |
| D6 | **i18n 与主题全链路打通**：`AppProviders.tsx` 统包 `ErrorBoundary` + `I18nProvider` + `ConfigProvider` + `useTheme` + `AntdApp`；更新窗口启动时拉取配置，并监听主题与语言变更动态更新 | 保证更新窗口在独立进程中与主窗口多语言、深浅色模式严格一致 |
| D7 | **Playwright E2E 自动化测试覆盖**：新增 `e2e/updater.spec.ts` 6 大测试用例；主进程状态机提供测试适配注入（Mock Updater Adapter），支持在无远端更新服务器环境下运行 CI 自动化流水线 | 消除无法真实更新的黑盒盲区，符合项目既有 E2E 规范 |
| D8 | **系统托盘联动正式接入**：既有 `tray.module.ts` 中预留的「检查更新」菜单项直接接入 `updaterService.check()` 并唤起 updater 窗口 | 消除 Spec 与已有代码冲突，统一入口体验 |
| D9 | **防僵尸进程生命周期闭环**：主窗口关闭时，仅在处于 `downloading` 状态才允许 updater 作为隐藏下载后台保留；其余状态随主窗口销毁并退出应用 | 防止 updater 窗口 hide 后导致应用永远无法退出（无界面僵尸进程） |

## 1. 范围

**In scope**：
- 更新检查、下载进度、changelog 展示、重启安装、错误重试。
- 更新窗口的打开/关闭/隐藏语义、防僵尸退出的生命周期闭环。
- home 窗口更名定义与 `window-registry` 唯一事实源。
- 托盘「检查更新」接通 updater 唤起与检查。
- 全链路 i18n 多语言（Lingui 提取）与主题跨窗口同步。
- 状态机可测性设计与 Playwright E2E 自动化测试套件（`e2e/updater.spec.ts`）。

**Out of scope（本版不做）**：
- 差分更新策略、stage 灰度分阶段安装。
- 源码签名/证书申请（沿用 electron-builder 既有配置）。
- in-app 渠道切换 UI（`VITE_DISTRIBUTION_CHANNEL` 保持构建期注入）。
- 自动回滚机制。

## 2. 窗口身份定义

```ts
// packages/shared/src/constants/windows.ts
export const WINDOW_IDS = {
  /** 原主窗口（更名定义）：dashboard / architecture 两个 tab 的宿主 */
  HOME: 'home',
  /** 自动更新窗口：changelog + 进度 + 操作 */
  UPDATER: 'updater',
} as const;

export type WindowId = (typeof WINDOW_IDS)[keyof typeof WINDOW_IDS];
```

主进程侧唯一事实源 + 广播工具：

```ts
// packages/main/src/modules/window/window-registry.ts
const registry = new Map<WindowId, BrowserWindow>();
export function registerWindow(id: WindowId, win: BrowserWindow): void;
export function forgetWindow(id: WindowId, win: BrowserWindow): void;  // 按实例注销，防止旧引用
export function getWindow(id: WindowId): BrowserWindow | undefined;
export function sendToWindow(id: WindowId, channel: string, payload: unknown): boolean;
export function broadcast(channel: string, payload: unknown): void;    // 全窗口广播（用于配置/语言/主题同步）
```

## 3. 目录编排

```text
e2e/
├── helpers/
│   ├── electron.ts             # 既有：launchElectronApp
│   └── fixture.ts              # 既有：Playwright test fixture
└── updater.spec.ts             # 新增：自动更新 6 大场景 E2E 测试

packages/shared/src/
├── constants/windows.ts        # WINDOW_IDS / WindowId（本 spec 新增）
├── constants/ipc-channels.ts   # + UPDATER_* 八条通道
├── constants/error-codes.ts    # + UPDATER_* 语义错误码
├── schemas/updater.ts          # zod：状态 / 进度 / ReleaseInfo / 快照
└── types/updater.ts            # 与 schema 同源的 TS 类型 + UpdaterEvent 判别联合

packages/main/src/
├── AppInitConfig.ts            # renderer → windows: { home, updater }
├── index.ts                    # initApp 注入两个窗口入口 + updater-window module
├── controllers/updater.controller.ts    # registerUpdaterControllers()
├── controllers/index.ts                  # + registerUpdaterControllers()
├── services/updater.service.ts           # 状态机单例 updaterService（持有 CancellationToken 与 TestMock）
├── modules/
│   ├── tray.module.ts                    # 接通「检查更新」菜单项调用 updaterService
│   ├── auto-terminate.module.ts          # 结合 updater 运行态判定退出策略（防僵尸进程）
│   └── window/
│       ├── index.module.ts               # home 窗口（改为经 registry 注册，修复 restore 逻辑）
│       ├── window-registry.ts            # 新增：窗口注册表与广播中心
│       ├── window-state-keeper.ts        # 既有（仅 home 使用）
│       └── updater-window.module.ts      # createUpdaterWindowModule({ initConfig })

packages/preload/src/index.ts   # + updater 命名空间（4 invoke + 2 订阅 + 2 open/close）

packages/renderer/
├── index.html                  # 既有入口
├── updater.html                # 新增入口
├── vite.config.ts              # build.rolldownOptions.input = { main, updater }
├── package.json                # exports + "./updater.html"
└── src/
    ├── main.tsx                # 既有：挂 <AppProviders><App /></AppProviders>
    ├── main.updater.tsx        # 新增：挂 <AppProviders><UpdaterFeature /></AppProviders>
    ├── components/layout/AppProviders.tsx   # 新增（统包 ErrorBoundary, I18nProvider, ConfigProvider, useTheme）
    ├── features/updater/
    │   ├── index.tsx           # UpdaterFeature：更新窗口根组件（无 Header/tab）
    │   ├── hooks/useUpdater.ts # 状态订阅 + 命令下发，输出 viewModel
    │   └── components/{ChangelogCard,ProgressCard,ActionBar}.tsx
    └── features/settings/      # +「检查更新」按钮（调用 updater.openWindow）
```

## 4. IPC 契约

```ts
// 命令（invoke，一律 Result<T> 契约）
UPDATER_GET_STATE: 'updater:get-state'        // () => Result<UpdaterSnapshot>
UPDATER_CHECK: 'updater:check'                // () => Result<UpdaterSnapshot>
UPDATER_DOWNLOAD: 'updater:download'          // () => Result<UpdaterSnapshot>
UPDATER_CANCEL: 'updater:cancel'              // () => Result<UpdaterSnapshot>
UPDATER_INSTALL: 'updater:install'            // () => Result<{ success: boolean }>
UPDATER_OPEN_WINDOW: 'updater:open-window'    // () => Result<{ success: boolean }>  // 手动唤起更新窗口
UPDATER_CLOSE_WINDOW: 'updater:close-window'  // () => Result<{ success: boolean }> // 渲染层请求隐藏窗口

// 推送（主 → 渲染，发往 updater 窗口）
UPDATER_EVENT_STATE: 'updater:event:state'        // (UpdaterSnapshot) => void
UPDATER_EVENT_PROGRESS: 'updater:event:progress'  // (UpdaterProgress) => void

// 测试专用通道（仅 NODE_ENV === 'test' 生效，供 E2E 注入状态）
UPDATER_MOCK_EMIT: 'updater:mock:emit'        // (UpdaterMockAction) => Result<void>
```

preload 形状（含事件订阅规范）：

```ts
updater: {
  getState(): Promise<Result<UpdaterSnapshot>>;
  check(): Promise<Result<UpdaterSnapshot>>;
  download(): Promise<Result<UpdaterSnapshot>>;
  cancel(): Promise<Result<UpdaterSnapshot>>;
  install(): Promise<Result<{ success: boolean }>>;
  openWindow(): Promise<Result<{ success: boolean }>>;
  closeWindow(): Promise<Result<{ success: boolean }>>;
  /** 返回取消订阅函数，渲染层必须在 useEffect cleanup 中调用 */
  onStateChanged(cb: (s: UpdaterSnapshot) => void): () => void;
  onProgressChanged(cb: (p: UpdaterProgress) => void): () => void;
}
```

错误码（`shared/src/constants/error-codes.ts` 追加）：

```text
UPDATER_CHECK_FAILED / UPDATER_DOWNLOAD_FAILED / UPDATER_INSTALL_FAILED
UPDATER_NO_UPDATE        // 非 available 态调用 download
UPDATER_ALREADY_RUNNING  // 重复 check / 重复 download（幂等保护）
```

## 5. 主进程状态机与生命周期

`UpdaterState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'`

| 当前态 | 事件 / 命令 | 下一态 | 副作用 |
| --- | --- | --- | --- |
| idle | `check()` | checking | electron-updater `checkForUpdates()` |
| checking | `update-available(info)` | available | **自动打开/显示 updater 窗口**，广播 state |
| checking | `update-not-available` | up-to-date | 广播 state；手动检查时窗口提示已是最新 |
| available | `download()` | downloading | 创建 `CancellationToken` 并调用 `downloadUpdate(cancellationToken)` |
| downloading | `cancel()` | available | 调用 `cancellationToken.cancel()` 并释放，停止下载 |
| downloading | `download-progress(p)` | downloading | 广播 progress（节流 ≤ 4 次/秒） |
| downloading | `update-downloaded` | downloaded | 提示「重启并安装」，释放 cancellationToken；**若 home 窗口已销毁（孤儿态），自动执行策略 A：直接 quitAndInstall(true, false) 静默退出安装** |
| downloading/available | `error(e)` | error | 广播 state，`ActionBar` 进入重试态，释放 cancellationToken；若 home 窗口已销毁，直接 app.quit() 退出 |
| downloaded | `install()` | installing | `quitAndInstall(false, true)`，进程安全退出并拉起安装程序 |
| error | `check()` / `download()` | 回到对应起始态 | 重试入口 |

硬性规则：

1. **幂等控制**：已在目标态时重复命令返回 `UPDATER_ALREADY_RUNNING`，不重复触发底层任务。
2. **下载取消与 CancellationToken 托管**：`updater.service.ts` 显式持有当前下载事务的 `CancellationToken`；调用 `cancel()` 时中断网络请求并重置状态为 `available`；再次调用 `download()` 时重新创建 token 实例。
3. **关闭 ≠ 取消**：下载中点关闭只隐藏窗口，`cancel()` 是唯一显式取消途径。
4. **dev 模式语义**：`NODE_ENV !== 'production' && NODE_ENV !== 'test'` 时默认禁用外部网络请求，窗口打开展示「开发模式不可用」，支持本地假数据调试。
5. **E2E 测试适配（Test Hook）**：在 `NODE_ENV === 'test'` 环境下，`updater.service.ts` 启用 `TestMockAdapter`，可以通过 `updater:mock:emit` 或 `globalThis.__updaterMock` 模拟注入 `update-available`、`download-progress`、`error` 等事件，驱动完整的 UI 状态演进。
6. **状态补拉机制**：updater 窗口每次 `did-finish-load` 后主动执行 `updater:get-state` 一次，确保窗口加载完成即对齐最新快照。
7. **ReleaseNotes 归一化**：将 `string | string[] | null` 统一在 service 层解析为标准化 `string[]`，并去除潜在危险 HTML 标签。

## 6. 渲染层

### 6.1 入口与壳层抽取（`AppProviders.tsx`）

将通用 Provider 从原 `App.tsx` 提取至 `components/layout/AppProviders.tsx`，供 `main.tsx` 和 `main.updater.tsx` 复用：

```tsx
// packages/renderer/src/components/layout/AppProviders.tsx
export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const resolvedTheme = useAppStore((state) => state.resolvedTheme);
  const language = useAppStore((state) => state.language);

  // 初始化并跟踪应用主题（设置 html 标签 data-theme 及 dark 类名）
  useTheme();

  // 国际化语言包按需动态激活
  useEffect(() => {
    dynamicActivate(language);
  }, [language]);

  return (
    <ErrorBoundary>
      <I18nProvider i18n={i18n}>
        <ConfigProvider theme={getAntdThemeConfig(resolvedTheme)} locale={getAntdLocale(language)}>
          <AntdApp>{children}</AntdApp>
        </ConfigProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
};
```

- `main.tsx`：挂载 `<AppProviders><App /></AppProviders>`。
- `main.updater.tsx`：挂载 `<AppProviders><UpdaterFeature /></AppProviders>`。
- `features/updater/index.tsx`：更新窗口视图根，单列纵向布局，包含应用图标/版本标头、`ChangelogCard`、`ProgressCard` 与 `ActionBar`。

### 6.2 跨窗口主题与多语言同步

1. **初始状态注入**：updater 窗口挂载时，`useAppStore` 通过 preload 调用 `config.get('theme')` 与 `config.get('language')` 完成本地 store 初始化。
2. **多语言更新**：所有 updater 界面文案必须使用 `@lingui/macro` 的 `t` 或 `<Trans>` 宏包裹（如 `t`正在检查更新...``、`t`立即更新``、`t`重启并安装`` 等），并通过 `pnpm i18n:extract` 提取。
3. **配置广播联动**：当主窗口通过 Settings 修改语言或主题时，主进程通过 `window-registry` 向 updater 窗口广播最新配置，updater 窗口触发 store 更新并同步渲染。

### 6.3 卡片与交互组件矩阵

| 组件 | 职责 |
| --- | --- |
| `ChangelogCard` | 目标版本号、发布日期、`notes[]` 渲染（支持安全 Markdown 格式解析；外链严格校验白名单，点击调用 `shell.openExternal`） |
| `ProgressCard` | `percent` 进度条 + `bytesPerSecond` + `transferred/total` 格式化（使用 i18n 单位）；仅在 `downloading` 状态展示 |
| `ActionBar` | 底部动作按钮组，按状态机流转展示对应操作 |

| 状态 (State) | 主操作 (Primary Action) | 次要操作 (Secondary Action) |
| --- | --- | --- |
| `checking` | 无 | 取消 / 关闭（隐藏窗口） |
| `available` | 立即更新 | 稍后提醒（隐藏窗口） |
| `downloading` | 隐藏到后台（保持下载） | 取消下载（中断并复位） |
| `downloaded` | 重启并安装 | 稍后安装（隐藏窗口） |
| `up-to-date` | 知道了 / 关闭 | 无 |
| `error` | 重试 | 关闭窗口 |
| `idle`（开发模式） | 关闭窗口 | 无 |

## 7. 窗口生命周期与进程退出策略（防僵尸退出机制）

| 场景 | 现有机制冲突 | 决策与实现策略 |
| --- | --- | --- |
| **主窗口恢复 (Restore)** | `WindowManager` 使用 `getAllWindows().find(...)` 容易错把 updater 激活 | 改为 `getWindow(WINDOW_IDS.HOME)` 精准聚焦，注册进入 `window-registry` |
| **单例与二次唤醒** | `second-instance` / `activate` 会随机激活任意窗口 | 统一通过 `getWindow(WINDOW_IDS.HOME)` 激活主窗口；若 home 不存在才激活 updater |
| **窗口关闭与隐藏** | updater 窗口关闭按钮被拦截为 `hide()`，依然驻留内存 | 明确 updater `close` 事件：默认调用 `win.hide()`，不销毁窗口实例以保留下载上下文 |
| **应用退出判定 (Terminate)** | 若有 updater 窗口（哪怕是隐藏的），`window-all-closed` 不会触发，导致后台僵死 | **退出策略闭环**（见下文规则） |
| **系统托盘「检查更新」** | 原 `tray.module.ts` 仅有空占位 | 正式接入：点击直接触发 `updaterService.check()` 并调用 `updaterWindowModule.show()` |

### 退出判定防僵尸闭环规则（含策略 A 与超时守护）：

1. **主窗口 (home) 触发关闭**：
   - 若用户配置了 `minimizeToTray: true`：home 窗口正常隐藏到托盘，应用保持后台常驻。
   - 若用户**未配置托盘**（常规退出）：
     - 检查 updater 状态机：
       - 若当前处于 `downloading` 状态：保持后台下载，向系统托盘/通知中心发送提示“应用已最小化，正在后台下载更新...”，同时启动**孤儿下载超时守护器（Orphan Download Watchdog）**；
       - 若当前为非下载状态（`idle` / `available` / `downloaded` / `up-to-date` / `error`）：主进程立即显式销毁 updater 窗口，并调用 `app.quit()` 彻底退出，杜绝后台无界面僵尸进程。

2. **孤儿后台下载的生命周期与超时防御（策略 A）**：
   - **下载完成（策略 A）**：当 `home` 窗口已销毁、后台下载成功到达 `downloaded` 态时，清除超时计时器，立即调用 `updater.quitAndInstall(true, false)`（静默退出进程并执行安装程序，不强制自动拉起），干净闭环退出。
   - **超时强制退出（Watchdog Timeout）**：孤儿后台下载启动守护计时器（默认 15 分钟无进度进展或总耗时上限），若网络卡死或下载长期停滞，超时器立即触发：调用 `cancellationToken.cancel()` 中断下载任务，记录超时日志并发送系统通知，最后显式执行 `app.quit()` 退出进程，严防在任务管理器无限期挂起。
   - **下载失败立即退出**：孤儿下载期间若抛出网络异常进入 `error` 态，鉴于主界面已关闭且无可见交互入口，主进程记录 `logger.error` 后立即调用 `app.quit()` 退出应用，不再挂起等待用户重试。
3. **主窗口仍存活时的正常退出**：
   - 用户在 updater 界面主动点击「重启并安装」，直接调用 `updater.quitAndInstall(false, true)` 退出并重启应用。

## 8. 安全边界（不变式）

- updater 窗口的 `webPreferences` 与 home 严格一致：`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`、`webviewTag: false`，复用同一 preload 隔离桥。
- 外部链接遵循白名单策略（`allowExternalUrls`），禁止任何 `window.open`，外部链接必须经由 preload `shell.openExternal` 校验后交由系统默认浏览器打开。
- 打包构建沿用 `sourcemap: 'hidden'` + electron-builder `!**/*.map` 排除规则，确保更新窗口 bundle 绝不向外暴露源码。
- 所有主渲染 IPC 推送与入参经过 zod Schema 强类型校验与断言。

## 9. 配置与打包

```ts
// packages/main/src/AppInitConfig.ts
type RendererEntry = { path: string } | URL;
export type AppInitConfig = {
  preload: { path: string };
  windows: {
    home: RendererEntry;
    updater: RendererEntry;
  };
};

// packages/main/src/index.ts
windows: {
  home: devServer ? new URL(devServer) : { path: require.resolve('@app/renderer') },
  updater: devServer
    ? new URL(`${devServer}updater.html`)
    : { path: require.resolve('@app/renderer/updater.html') },
}
```

- `packages/renderer/package.json`：
  - exports 追加 `"./updater.html": { "default": "./dist/updater.html" }`
- `packages/renderer/vite.config.ts`：
  - 导出多页面入口：`build.rollupOptions.input = { main: path.resolve(__dirname, 'index.html'), updater: path.resolve(__dirname, 'updater.html') }`

## 10. 自动化测试与验收标准（机械可验）

### 10.1 自动化 E2E 测试用例（`e2e/updater.spec.ts`）
运行 `pnpm test:e2e` 执行并通过以下用例：

1. **用例 1：设置页触发与更新窗口弹出**
   - 在主窗口 Settings 区域点击「检查更新」按钮；
   - 监听捕获新的 `updater` 窗口并断言其 URL 包含 `updater.html`、窗口可见且具备初始 checking 态。
2. **用例 2：新版本可用与 Changelog 渲染**
   - 注入新版本元数据（`v2.0.0`，包含多行 changelog 与发布日期）；
   - 断言界面成功展示版本号、日期以及更新日志文本，主按钮显示为「立即更新」。
3. **用例 3：下载流程与进度条推进**
   - 点击「立即更新」按钮；
   - 持续注入下载进度（`25%`, `50%`, `100%`）；
   - 断言 `ProgressCard` 渲染，进度条与格式化传输速率实时更新。
4. **用例 4：下载就绪与安装引导**
   - 模拟下载完成事件（`downloaded`）；
   - 断言界面展示「重启并安装」主按钮，以及次要按钮「稍后安装」。
5. **用例 5：下载中断错误与重试**
   - 模拟下载网络异常触发 `error` 态；
   - 断言错误提示展示，主按钮切换为「重试」，点击重试可重新发起检查或下载。
6. **用例 6：窗口隐藏保留与后台下载连续性**
   - 在下载过程中点击关闭或「隐藏到后台」按钮；
   - 断言更新窗口状态变为不可见（`hide`），但后台下载持续进行；
   - 主窗口再次点击「检查更新」，更新窗口重新显示，且进度条保持最新连续进度。

### 10.2 代码规范与构建验收
1. `packages/shared` 导出 `WINDOW_IDS` / `WindowId`，且 `IPC_CHANNELS` 包含完整 UPDATER 通道。
2. `packages/main/src/controllers/index.ts` 调用 `registerUpdaterControllers()`；`initApp` 链路包含 `createUpdaterWindowModule`。
3. `packages/preload/src/index.ts` 的 `apiBridge` 具备 `updater` 命名空间，`onStateChanged` / `onProgressChanged` 返回清理函数。
4. `pnpm i18n:extract` 提取无报错，updater 相关 key 已被正确收集入 `messages.po`。
5. `pnpm --filter @app/renderer build` 产出 `dist/updater.html` 及其独立 chunk。
6. `pnpm typecheck`（`tsc -b`）+ `pnpm lint`（`biome check`）0 error 0 warning。
7. 主窗口关闭时无残留无界面的 Node/Electron 僵尸进程。

## 11. 建议提交顺序

1. `feat(shared): 新增 windows 窗口身份定义与 updater 契约（channels/schemas/types/error-codes）`
2. `feat(main): 引入 window-registry 并将主窗口注册为 home`（含 restore/last-window-close 退出判定修正）
3. `feat(main): 新增 updater 状态机 service（含 CancellationToken 与 E2E mock adapter）及 updater-window module`
4. `feat(main): 托盘菜单「检查更新」接入 updaterService`
5. `feat(preload): 暴露 updater 命名空间与事件订阅约定`
6. `feat(renderer): 提取 AppProviders，新增 updater.html 入口与 updater feature`
7. `feat(renderer): Settings 增加检查更新手动入口与多语言抽取`
8. `test(e2e): 新增 updater.spec.ts 覆盖 6 大更新交互场景`

## 12. 未决问题

1. macOS 上 `quitAndInstall` 需要签名校验，打包未签名版本在 macOS 本地实测时是否需降级提示手动下载安装包？
2. `VITE_DISTRIBUTION_CHANNEL` 是否需在更新窗口底部用微缩标签（如 `beta` / `latest`）展示当前渠道？