# 自动更新窗口（Updater Window）功能 Spec

> 版本：v1（待评审）　|　状态：设计定稿，未实现
> 关联：`packages/renderer/README.md`（分层规范）、`packages/shared/src/types/result.ts`（Result 契约）

## 0. 决策记录

| # | 决策 | 理由 |
| --- | --- | --- |
| D1 | 采用**方案 A：双入口**。`index.html` / `updater.html` 两个 Vite 入口，壳层件收敛到 `components/layout/AppProviders.tsx`，窗口根即 `features/updater/index.tsx` | 窗口身份显式；更新窗口只加载自己的小 bundle，与主界面解耦；不在 renderer src 引入新顶层目录 |
| D2 | 新增窗口身份定义：**`home` = 原主窗口（更名）**，`updater` = 更新窗口 | 原 "main window" 是隐语义；有了第二个窗口后必须显式命名，才能写清 restore / 广播 / 生命周期规则 |
| D3 | main 包内三层单向依赖：`services/updater.service.ts`（唯一与 electron-updater 对话）→ `modules/window/updater-window.module.ts`（唯一与 BrowserWindow 对话）→ `controllers/updater.controller.ts`（IPC 边界） | 与现有 controller/service 分层一致，窗口逻辑不被服务污染 |
| D4 | 事件推送走 preload `onXxx(cb) → unsubscribe` 约定 | 现有 `apiBridge` 全是 invoke，本功能首次引入推送；约定一次，后续复用 |
| D5 | home 侧手动入口**不新建 feature**，写进现有 `features/settings` 域 | README「Feature 规范 5」第二个消费者规则 |

## 1. 范围

**In scope**：更新检查、下载进度、changelog 展示、重启安装、错误重试、更新窗口的打开/关闭/隐藏语义、home 窗口更名定义。

**Out of scope（本版不做）**：差分更新策略、stage 灰度分阶段安装、码签名/证书配置（沿用 electron-builder 既有 publisher 配置）、in-app 渠道切换 UI（`VITE_DISTRIBUTION_CHANNEL` 保持构建期注入）、自动回滚。

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

主进程侧唯一事实源 + 广播工具（新文件，替代现有 "任意窗口" 查找）：

```ts
// packages/main/src/modules/window/window-registry.ts
const registry = new Map<WindowId, BrowserWindow>();
export function registerWindow(id: WindowId, win: BrowserWindow): void;
export function forgetWindow(id: WindowId, win: BrowserWindow): void;  // 按实例注销，防止旧引用
export function getWindow(id: WindowId): BrowserWindow | undefined;
export function sendToWindow(id: WindowId, channel: string, payload: unknown): boolean;
```

## 3. 目录编排

```text
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
├── services/updater.service.ts           # 状态机单例 updaterService
└── modules/window/
    ├── index.module.ts                   # home 窗口（既有，改为经 registry 注册）
    ├── window-registry.ts                # 新增
    ├── window-state-keeper.ts            # 既有（仅 home 使用）
    └── updater-window.module.ts          # createUpdaterWindowModule({ initConfig })

packages/preload/src/index.ts   # + updater 命名空间（4 invoke + 2 订阅 + 2 open/close）

packages/renderer/
├── index.html                  # 既有入口
├── updater.html                # 新增入口
├── vite.config.ts              # build.rolldownOptions.input = { main, updater }
├── package.json                # exports + "./updater.html"
└── src/
    ├── main.tsx                # 既有：挂 <AppProviders><App /></AppProviders>
    ├── main.updater.tsx        # 新增：挂 <AppProviders><UpdaterFeature /></AppProviders>
    ├── components/layout/AppProviders.tsx   # 新增（从 App.tsx 抽出壳层件）
    ├── features/updater/
    │   ├── index.tsx           # UpdaterFeature：更新窗口的根组件，无 Header/tab
    │   ├── hooks/useUpdater.ts # 状态订阅 + 命令下发，输出 viewModel
    │   └── components/{ChangelogCard,ProgressCard,ActionBar}.tsx
    └── features/settings/      # +「检查更新」按钮（调用 updater.openWindow）
```

## 4. IPC 契约

```ts
// 命令（invoke，一律 Result<T> 契约）
UPDATER_GET_STATE: 'updater:get-state'    // () => Result<UpdaterSnapshot>
UPDATER_CHECK: 'updater:check'            // () => Result<UpdaterSnapshot>
UPDATER_DOWNLOAD: 'updater:download'      // () => Result<UpdaterSnapshot>
UPDATER_CANCEL: 'updater:cancel'          // () => Result<UpdaterSnapshot>
UPDATER_INSTALL: 'updater:install'        // () => Result<{ success: boolean }>
UPDATER_OPEN_WINDOW: 'updater:open-window'// () => Result<{ success: boolean }>  // home 侧手动入口
UPDATER_CLOSE_WINDOW: 'updater:close-window'// () => Result<{ success: boolean }> // 渲染层请求隐藏窗口
// 推送（主 → 渲染，仅发往 updater 窗口）
UPDATER_EVENT_STATE: 'updater:event:state'      // (UpdaterSnapshot) => void
UPDATER_EVENT_PROGRESS: 'updater:event:progress' // (UpdaterProgress) => void
```

preload 形状（含首次出现的订阅约定）：

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

## 5. 主进程状态机

`UpdaterState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'`

| 当前态 | 事件 / 命令 | 下一态 | 副作用 |
| --- | --- | --- | --- |
| idle | `check()` | checking | electron-updater `checkForUpdates()` |
| checking | `update-available(info)` | available | **自动打开/显示 updater 窗口**，广播 state |
| checking | `update-not-available` | up-to-date | 广播 state；手动检查时窗口提示已是最新 |
| available | `download()` | downloading | `downloadUpdate()` |
 | `cancel()` | available | 停止下载，保留已下载分片 |
| downloading | `download-progress(p)` | downloading | 广播 progress（节流 ≤ 4 次/秒） |
| downloading | `update-downloaded` | downloaded | 提示「重启并安装」 |
| downloading/available | `error(e)` | error | 广播 state，`ActionBar` 进入重试态 |
| downloaded | `install()` | installing | `quitAndInstall(false, true)`，进程退出 |
| error | `check()` / `download()` | 回到对应起始态 | 重试入口 |

硬性规则：

1. **幂等**：已在目标态时重复命令返回 `UPDATER_ALREADY_RUNNING`，不重复触发 electron-updater。
2. **关闭 ≠ 取消**：下载中点关闭只隐藏窗口，`cancel()` 是唯一显式取消途径。
3. **dev 禁用的是检查流程，不是窗口**：`NODE_ENV !== 'production'` 时 service 保持 `idle`（沿用 `auto-updater.module.ts` 现有语义），窗口仍可打开并展示「开发模式不可用」。
4. **状态快照可补拉**：updater 窗口每次 `did-finish-load` 后主动 `updater:get-state` 一次，避免漏掉打开前的推送事件。
5. `releaseNotes` 在 electron-updater 中为 `string | string[] | null`，service 归一化为 `string[]` 后经 zod 校验再下发，渲染层不做类型防御。

## 6. 渲染层

### 6.1 入口与壳层

- `components/layout/AppProviders.tsx`：`ErrorBoundary` + `ConfigProvider(getAntdThemeConfig(resolvedTheme))` + `useTheme()` + `AntdApp`；`App.tsx` 与 `main.updater.tsx` 复用。
（提取后 `App.tsx` 自身只剩 tab 编排，`main.tsx` / `main.updater.tsx` 各自三行：createRoot + `./styles/index.css` + 挂载。）
- `features/updater/index.tsx` 即窗口根：不套 `App.tsx` 的 grid/tab，只有一列纵向布局（参照 `features/architecture/ArchitectureView` 的整屏 view 先例）。

### 6.2 `useUpdater` viewModel

```ts
interface UpdaterViewModel {
  state: UpdaterState;
  release: ReleaseInfo | null;    // 版本号 / 发布日期 / notes[]
  progress: UpdaterProgress | null;
  error: string | null;
  isLoading: boolean;             // 命令在途（未过期响应丢弃）
  check(): void; download(): void; install(): void; cancel(): void;
  retry(): void;                  // = 按当前态回到 check 或 download
  close(): void;                  // updater:close-window（隐藏而非销毁）
}
```

实现约束（沿用 README）：单 channel 用 `useIpc`，事件订阅用 `useEffect` + preload `onXxx` 且 cleanup 必须取消订阅；错误提示统一 `message.error`；禁止手写 `window.api` + `res.success`。

### 6.3 卡片与按钮矩阵

| 组件 | 职责 |
| --- | --- |
| `ChangelogCard` | 目标版本号、发布日期、`notes[]` 渲染（纯文本逐行；含外链时只渲染白名单域名的链接，点击走 `shell` 已有能力，禁止 `window.open`） |
| `ProgressCard` | `percent` 进度条 + `bytesPerSecond` + `transferred/total`；非 downloading 态隐藏 |
| `ActionBar` | 按 state 显隐按钮组 |

| state | ActionBar |
| --- | --- |
| checking | 取消（= 隐藏窗口） |
| available | 立即更新（主）/ 稍后 |
| downloading | 隐藏到后台（cancel 收进次级按钮） |
| downloaded | 重启并安装（主） |
| up-to-date | 关闭 |
| error | 重试（主）/ 关闭 |
| idle（dev） | 关闭 |

## 7. 窗口生命周期与既有机制的冲突点（必须改）

| 现有机制 | 冲突 | 处理 |
| --- | --- | --- |
| `WindowManager.restoreOrCreateWindow` 用 `getAllWindows().find(任意)` | home 缩托盘后 restore 会拉起 updater 窗口 | 改为 `getWindow(WINDOW_IDS.HOME)`，窗口注册进 `window-registry` |
| `single-instance` / `activate` 复用同一 restore 路径 | 同上 | 同上 |
| `terminateAppOnLastWindowClose` | 只剩 updater 窗口时不应退出应用 | 关闭判定排除 `WINDOW_IDS.UPDATER` |
| `WindowStateKeeper` | updater 窗口固定尺寸，不需要持久化 | 不启用（`keepState: false`） |
| `tray` 模块 | 是否需要「检查更新」入口 | 本版不加，列入未决 |

updater 窗口建议参数：`width 520 / height 640`、`resizable: false`、`show: false` + `ready-to-show`、`autoHideMenuBar: true`、非 modal（不阻塞 home）。

## 8. 安全边界（不变式）

- updater 窗口的 `webPreferences` 与 home 完全一致：`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`、`webviewTag: false`、复用同一 preload。
| `allowExternalUrls` 白名单已含 `https://github.com`（changelog 外链），不新增域名。
| 构建配置沿用 `sourcemap: 'hidden'` + electron-builder `!**/*.map`，更新窗口 bundle 同样不泄漏源码。
| 所有推送 payload 经 zod 校验；渲染层只消费类型，不做 `as` 兜底。

## 9. 配置与打包

```ts
// AppInitConfig.ts
type RendererEntry = { path: string } | URL;
export type AppInitConfig = {
  preload: { path: string };
  windows: { home: RendererEntry; updater: RendererEntry };
};

// main/src/index.ts
windows: {
  home: devServer ? new URL(devServer) : { path: require.resolve('@app/renderer') },
  updater: devServer ? new URL(`${devServer}updater.html`) : { path: require.resolve('@app/renderer/updater.html') },
}
```

`packages/renderer/package.json` exports 追加 `"./updater.html": { "default": "./dist/updater.html" }`；vite `input` 追加 `updater: 'updater.html'`；electron-builder `files` 无需改动（workspace dist 已全量纳入）。

## 10. 验收标准（机械可验）

1. `packages/shared` 导出 `WINDOW_IDS` / `WindowId`，且 `IPC_CHANNELS` 含 6 命令 + 2 事件通道（`grep UPDATER_ packages/shared/src/constants/ipc-channels.ts`）。
2. `packages/main/src/controllers/index.ts` 调用 `registerUpdaterControllers()`；`initApp` 链路包含 `createUpdaterWindowModule`。
3. `packages/preload/src/index.ts` 的 `apiBridge` 含 `updater` 命名空间，`onStateChanged` / `onProgressChanged` 返回取消订阅函数。
4. `packages/renderer/updater.html` 存在且脚本指向 `/src/main.updater.tsx`；`vite.config.ts` 的 `build.rolldownOptions.input` 含 `updater`。
5. `features/updater/{index.tsx,hooks/useUpdater.ts,components/ChangelogCard.tsx,components/ProgressCard.tsx,components/ActionBar.tsx}` 五个文件齐备，`index.tsx` 为唯一公开面。
6. `grep -r "res.success" packages/renderer/src/features` 为 0；`grep "AppProviders" packages/renderer/src/{App.tsx,main.tsx,main.updater.tsx}` 三处命中。
7. `pnpm --filter @app/renderer build` 产出 `dist/updater.html` 及独立 chunk。
8. `tsc -b` + `biome check` 0 error。
9. 手动冒烟：设置页点「检查更新」→ updater 窗口弹出并显示当前版本 changelog；点击下载 → 进度条推进；下载完成 → 「重启并安装」生效；下载中点关闭 → 再打开仍在下载且进度连续。

## 11. 建议提交顺序

1. `feat(shared): 新增 windows 窗口身份定义与 updater 契约（channels/schemas/types/error-codes）`
2. `feat(main): 引入 window-registry 并将主窗口注册为 home`（含 restore/last-window-close 修正）
3. `feat(main): 新增 updater 状态机 service 与 updater-window module`
4. `feat(preload): 暴露 updater 命名空间与事件订阅约定`
5. `feat(renderer): 提取 AppProviders 并新增 updater 入口与 updater feature`

## 12. 未决问题

1. macOS 上 `quitAndInstall` 需要签名校验，当前 publisher 配置是否覆盖更新窗口场景？需实测。
2. `VITE_DISTRIBUTION_CHANNEL` 是否需要在 updater 窗口展示当前渠道信息？
3. 托盘菜单是否加「检查更新」入口（本版未做）。
4. dev 模式下 updater 窗口是否提供"假数据"预览开关（便于调样式）。