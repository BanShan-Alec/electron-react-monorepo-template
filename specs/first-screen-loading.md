# Electron 首屏渐进式无缝加载规范 (First Screen Loading Spec)

> 版本：v2 | 状态：设计定稿 | v2 修订：壳资产源码外置 + 构建期内联（D8）、就绪门禁注册表与主进程就绪源（D9）、构建工具链时代规则（D10）；v2 决策依据见 [ADR-0002](../docs/adr/0002-startup-shell-build-time-inline.md) 与 [ADR-0003](../docs/adr/0003-startup-gate-registry.md)
> 关联：[README](../README.md)（分层架构与开发 SOP）· [CONTRIBUTING](../CONTRIBUTING.md)（代码风格与提交规范）· [titlebar-overlay.ts](../packages/main/src/modules/window/titlebar-overlay.ts)（窗口主题色单一事实源）· [ADR-0001](../docs/adr/0001-first-screen-keeps-opaque-wco-window.md)（窗口材质裁决）· `e2e/first-screen.spec.ts`（验收用例，随实施新增）
> 上游事实基线：[zai-org/ZCode](https://github.com/zai-org/ZCode) @ commit `29628c9acdb81b703bbd4080c207a0e7ce5e276e`（v3.14.3，2026-09-24）。本规范所有数值、事件名、实现结构均以该 commit 真实源码为准，引用格式为 `上游仓库相对路径 + 行号`。

---

## 0. 决策记录

| # | 决策 | 理由 |
| :--- | :--- | :--- |
| D1 | 窗口保持不透明 + WCO 标题栏，不引入 `backgroundMaterial` / `transparent` / `vibrancy` | Electron 官方文档明确 `backgroundMaterial` 仅支持 Windows 11 22H2（Build ≥ 22621）；WCO overlay 不支持透明色（[electron#48193](https://github.com/electron/electron/issues/48193)、[#39959](https://github.com/electron/electron/issues/39959)）；保住既有 WCO 体系（overlay 单一事实源 + `env(titlebar-area-*)` 避让 + 既有 e2e）。备选方案与完整权衡见 [ADR-0001](../docs/adr/0001-first-screen-keeps-opaque-wco-window.md) |
| D2 | 两段式视觉链：HTML 壳 → 真实 UI | 本仓无数据库，React commit 后首帧即真实内容；上游三段式的中段（React 同款骨架 `RootStartupLoading`）在本仓无消费者。未来引入重型异步水合（如数据库 admission）时按上游模式补中段 |
| D3 | 就绪协调器**内联**在 index.html，禁止抽成独立模块 | module script 按文档顺序执行，内联保证 `animationend` 监听在 0.72s 动画结束前挂载；若走 bundle 内模块，Windows 上杀毒扫描/慢盘可能使 bundle 解析超过 720ms 而丢失动画事件，只能吃 1000ms 兜底，凭空多等约 300ms |
| D4 | 就绪标识命名去品牌化，`app-` 前缀：`app-startup-ready` / `app-react-startup-ready` / `__APP_REACT_COMMIT_AT__` | 上游 `zcode-` 前缀不适用本仓；第 3 节映射表保证与上游源码可互溯 |
| D5 | 显示时序跟随上游：废除 `show: false` + `ready-to-show` 门禁，窗口创建即可见 | 启动壳接管首帧后，"等首帧就绪再显示"的门禁失去意义；win32 在 `dom-ready` 补 `show()+focus()`，maximize 前置于 load |
| D6 | 启动遥测仅取 T5 等价物（`__APP_REACT_COMMIT_AT__` + `performance.mark`），不建上报体系 | 上游 T0–T6 七段 marks + 7 个上报事件 + 时钟哨兵超出本特性体量 |
| D7 | 验收分层：e2e 只锁最终态与兜底上界，过程节奏（0.72s / 160ms / 500ms）归人工目测 | CI 环境时序抖动会造成脆测；过程节奏由人工清单覆盖 |
| D8 | 壳资产**源码外置、产物内联**：协调器以 TS 文件维护（`src/startup/coordinator.ts`）、Logo 以 SVG 文件维护（`src/assets/logo.svg`），由手写 Vite 插件在 `transformIndexHtml` 时编译/读取并内联进 index.html；dev 与 build 同一插件同一形态 | index.html 不再承载大段脚本，可维护、可类型检查、可复用 shared 常量；产物形态与 v1 完全一致（经典内联 `<script>`，先于 main.tsx），D3 的产物级论证原样保留。依据见 ADR-0002 |
| D9 | 就绪协调器从双门禁演进为**门禁注册表**：每类就绪源 = 事件/信号 + 独立兜底超时，全部齐备才交叉淡入；新增首个主进程就绪源 `app-startup-main-ready`（ModuleRunner 链初始化完成后闩锁，payload 携带初始化耗时），渲染端经 `api.startup.getSnapshot()` 引导期拉取 + 跨世界 DOM 事件订阅，先到信号不丢 | 未来主进程重型初始化（如数据库 admission）接入时零结构改动；管道（shared 契约 → main → preload → 壳）真实打通并被 e2e 覆盖，拓展性是已验证的管道而非纸面约定。依据见 ADR-0003 |
| D10 | 构建期转换一律使用 Vite 8 / Rolldown / Oxc 原生能力，**禁止引入 esbuild、babel 等旧工具链依赖**（存量 `@rolldown/plugin-babel`（lingui）不在此列，但不再扩用） | 本仓已进入 Vite 8（rolldown 内核）时代，新旧工具链并存会制造双事实源与无谓体积；规则成文于 CONTRIBUTING 与 ADR-0002 |

---

## 1. 范围

### In Scope

1. **窗口即时呈现**：废除 `show:false` + `ready-to-show` 显示门禁，窗口创建即可见，首个可视内容为主题底色（禁止白屏期）；
2. **0ms 静态启动壳**：Logo 弹出动画与加载指示完全内联在入口 HTML 中，不依赖任何打包产物，先于 React 可见；
3. **双门禁就绪协调**：壳动画完成 + React 首帧 commit 两条件齐备后，执行 160ms 交叉淡入；
4. **壳物理退场**：交叉淡入后 500ms 内将壳 DOM 从文档中移除，内存零残留；
5. **无边框重绘守护**：win32 无边框窗口全生命周期挂载重绘守护，消除跨屏拖拽、Snap 贴靠、锁屏唤醒的黑边残影；
6. **主题底色一致**：窗口底色与 WCO overlay 色同源（深色 `#141414` / 浅色 `#ffffff`），壳浮于其上，深浅主题均无违和。

### Out of Scope（禁止顺手实现）

1. **透明原生材质**（`backgroundMaterial` / `transparent` / `vibrancy`）：不引入，裁决见 ADR-0001 与 D1。事实备注：上游 v3.14.3 对 win32 无条件使用 `backgroundMaterial: 'acrylic'`（无版本门禁）；若未来引入，门禁阈值必须以 **22621** 为准（早期方案推演中采用的 22000 有误，Win11 21H2 22000–22620 并不支持该 API）。
2. **自绘窗口控制按钮**：不采纳上游 `DesktopWindowControls.tsx` + 桌面命令 IPC 方案，本仓保持 WCO（`titleBarOverlay`）体系不动。
3. **三段式视觉链中段**：见 D2。
4. **Updater 窗口接壳**：`updater.html` 是独立入口，天然隔离，不接壳、不加分支（上游的 `isUpdateStatusWindow` 跳过逻辑因此不需要）。
5. **主题防跳变**：`config.get()` 异步回填主题类导致的切换闪烁是独立问题，不混入本规范。上游先例备查：`packages/ui/src/Root.tsx` L760-768 将 nativeTheme 同步刻意延迟至启动壳退场之后。
6. **启动遥测上报体系**：见 D6。
7. **窗口圆角守卫 IPC**：上游 `supportsNativeWindowsRoundedCorners`（`WINDOWS_11_FIRST_BUILD = 22000`，`packages/desktop/src/main/desktopWindowChromeState.ts` L4, L19-27）服务于原生圆角经 IPC 同步渲染端；本仓无窗口圆角处理，不引入。

---

## 2. 术语

| 术语 | 定义 |
| :--- | :--- |
| **启动壳 (Startup Shell)** | React 引导前内联在入口 HTML 中的静态首屏层，负责即时视觉呈现与加载期窗口拖拽 |
| **就绪协调器 (Readiness Coordinator)** | 内联在启动壳脚本中的状态机，汇聚各就绪条件后统一触发主界面显形与壳退场 |
| **双门禁 (Dual Gate)** | 就绪协调器的两个前置条件——壳动画完成与 React 首帧提交，二者齐备才允许显形 |
| **交叉淡入 (Cross-Fade)** | 主界面渐入与启动壳渐出同时进行的 160ms 过渡 |
| **窗口控制遮罩 (WCO)** | 操作系统绘制的原生窗口控制按钮层，经 `titleBarOverlay` 启用 |

---

## 3. 上游命名映射与关键源码索引

### 命名映射表

| 概念 | 上游（`zcode-` 前缀） | 本仓（`app-` 前缀） |
| :--- | :--- | :--- |
| 就绪 body class | `zcode-startup-ready` | `app-startup-ready` |
| React 就绪 DOM 事件 | `zcode-react-startup-ready` | `app-react-startup-ready` |
| React commit 时间戳全局变量 | `__ZCODE_REACT_COMMIT_AT__` | `__APP_REACT_COMMIT_AT__` |
| 通知组件 | `StartupReadyNotifier` | `StartupReadyNotifier`（同名） |
| 壳动画 keyframes | `startup-logo-pop` | `startup-logo-pop`（同名） |
| 协调器位置 | index.html 内联 `<script type="module">` | **源码** `packages/renderer/src/startup/coordinator.ts`，构建期由手写插件内联进 index.html（**产物**仍是经典内联 `<script>`，见 D8 / ADR-0002） |

### 关键源码索引（上游 @ `29628c9`）

| 主题 | 上游文件与位置 |
| :--- | :--- |
| 壳样式 / 壳标记 / 内联协调器 | `packages/desktop/src/renderer/index.html` L16-105 / L110-136 / L139-188 |
| `StartupReadyNotifier` | `packages/desktop/src/renderer/src/main.tsx` L248-259 |
| 视效选项 / 窗口创建 / 重绘守护 | `packages/desktop/src/main/desktopWindowChrome.ts` L136-168 / L571-594 / L227-263（挂载点 L614） |
| win32 `dom-ready` 补 show+focus | `packages/desktop/src/main/desktopWindowLifecycle.ts` L125-134 |
| 圆角守卫（未采纳，仅事实引用） | `packages/desktop/src/main/desktopWindowChromeState.ts` L4, L19-27 |
| 三段式中段（未采纳） | `packages/ui/src/root/RootStartupLoading.tsx`、`packages/ui/src/Root.tsx` L967-980 |
| 主题护栏先例（非目标引证） | `packages/ui/src/Root.tsx` L760-768 |
| 遥测 marks（仅取 T5 等价物） | `packages/shared/src/launchMarks.ts`、`packages/ui/src/lib/uiPerfArmsTelemetry.ts` |

---

## 4. 设计

### 4.1 窗口显示时序与底色（主进程）

改动全部落在 `packages/main/src/modules/window/`：

- **4.1.1 废除显示门禁**：删除 `index.module.ts` 中 BrowserWindow 构造项 `show: false`（L80）与整个 `once('ready-to-show')` 块（L113-122）。窗口构造后立即可见（对齐上游：构造项不含 `show:false`，默认可见）。
- **4.1.2 maximize 前置**：`savedState.isMaximized` 的 `maximize()` 调用迁移到 `loadURL/loadFile`（L176-180）**之前**执行（对齐上游 `desktopWindowChrome.ts` L602-604：maximize 先于 loadWindow），杜绝可见的尺寸跳变。
- **4.1.3 win32 dom-ready 补偿**：`webContents.on('dom-ready')` 中执行 `win.show(); win.focus();`（仅 win32，需 `!win.isDestroyed()` 守卫；对齐上游 `desktopWindowLifecycle.ts` L125-134）。
- **4.1.4 devTools 时机迁移**：原 ready-to-show 块内的 `openDevTools()`（仅 dev）迁移至 4.1.3 同一 `dom-ready` 回调点。
- **4.1.5 窗口底色对齐主题**：`titlebar-overlay.ts` 新增导出 `getWindowBackgroundColor(): string`，与 `getTitleBarOverlayOptions()` 同源同主题分支（`nativeTheme.shouldUseDarkColors ? '#141414' : '#ffffff'`）；`index.module.ts` 构造项增加 `backgroundColor: getWindowBackgroundColor()`。**严禁**出现第二处硬编码色值。渲染端 `html/body/#root` 保持 `background: transparent`，由窗口底色透出。
- **4.1.6 WCO 冻结**：`titleBarStyle` / `frame` / `titleBarOverlay` 既有平台分支（L85-92）一字不动；`native-theme.module` 的运行时 overlay 更新不动。
- **4.1.7 无边框重绘守护**：新增 `packages/main/src/modules/window/window-repaint.ts`，导出 `attachWindowsWindowRepaint(win: BrowserWindow): void`，在 `createWindow()` 中挂载。实现要求：
  - 非 win32 直接返回；
  - `repaint()`：双判空（`win.isDestroyed() || win.webContents.isDestroyed()` 任一为真即跳过）后调用 `win.webContents.invalidate()`；
  - `scheduleRepaint()`：**立即执行一次 repaint，再排 32ms 定时器执行第二次**（有界双帧，非纯防抖）；
  - 监听 `'resized'`（低频结束事件，**严禁**改为高频 `'resize'`）与 `'show'`（最小化恢复/锁屏唤醒）；
  - 定时器触发前清空引用，避免对已销毁窗口排程。

### 4.2 HTML 启动壳（渲染端）

改动文件：`packages/renderer/index.html`。v2 目标形态：**样式继续内联冻结**（壳自足红线只豁免协调器与 Logo 的源码外置，CSS 无外部依赖问题且 Tailwind 不可用，见 §4.2 硬性约束），协调器与 Logo 缩为占位符，由插件（§4.7）在 dev 与 build 统一替换：

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>renderer</title>
    <style>
      /* 内容与 v1 冻结版逐字一致（§4.2 v1 版本），此处省略：
         html/body/#root 透明、#root 与 #loading 的 0.16s 交叉淡入、
         .startup-logo-shell 规格与 startup-logo-pop 关键帧、prefers-reduced-motion 降级。
         注意：background: transparent !important 的 biome noImportantStyles 抑制
         移至 .config/biome.json 文件级 overrides（v2 起 HTML 内不放抑制注释）。 */
    </style>
  </head>
  <body>
    <div id="root"></div>
    <div id="loading" role="status" aria-busy="true" aria-label="Loading...">
      <div class="startup-logo-shell">
        <div class="startup-logo-slot">
          <!-- __APP_STARTUP_LOGO__ -->
        </div>
      </div>
    </div>
    <!-- __APP_STARTUP_COORDINATOR__ -->
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

占位符契约（插件替换，形态冻结）：

- `<!-- __APP_STARTUP_LOGO__ -->`：替换为 `packages/renderer/src/assets/startup-logo.svg` 的**文件原文**（去除 XML 声明与注释）。素材为 Header 同款——`--color-primary` 蓝底（#1677ff）+ 白色 Thunderbolt 雷电；壳先于应用样式加载，CSS 变量不可用，故色值在 SVG 内固化（品牌蓝不属 §6.5 窗口底色单一事实源约束范围）；换素材只改此文件，HTML 零改动。
- `<!-- __APP_STARTUP_COORDINATOR__ -->`：替换为 `<script>...</script>`，内容为 `src/startup/coordinator.ts` 打包产出的经典 IIFE（非 module，§10.3 结论不变），**物理位置必须仍在 main.tsx 的 script 之前**。

硬性约束：

1. **产物零外部依赖（红线承袭）**：替换后的 index.html 产物不得引用任何打包产物或网络资源——协调器 IIFE 自包含（含其 import 的 shared 常量），Logo 原文内联。dev 与 build 走同一插件同一替换，形态一致（D8 / Q6-A）。
2. **样式内联冻结**：`<style>` 块继续完整内联在 index.html 源码中；Tailwind content 仅扫描 `./src/**`，壳中禁用任何 Tailwind 工具类与任意属性类。
3. `updater.html` 不做任何改动（入口隔离红线不变）。
4. 已知开发期现象（接受）：dev 模式 HMR 全量刷新时壳动画会重播一次。

### 4.3 门禁注册表就绪协调器（源码 `src/startup/coordinator.ts`）

源码文件：`packages/renderer/src/startup/coordinator.ts`（TS，允许 import `@app/shared/constants/*` 纯常量——构建期内联时一并打包；**裸 DOM 引导层豁免承袭 v1 §6.2**：不适用 7 段式与 manual-only Hook 约束，但严禁 import 打包产物、组件、样式或网络资源）。构建产物为经典 IIFE 内联脚本（§4.2 占位符契约），行为冻结如下（参考实现）：

```ts
import {
  APP_REACT_STARTUP_READY_EVENT,
  APP_STARTUP_MAIN_READY_EVENT,
  APP_STARTUP_READY_CLASS,
} from '@app/shared/constants/startup';

// 私有常量
const ANIMATION_FALLBACK_MS = 1000;
const REACT_FALLBACK_MS = 3000;
const MAIN_FALLBACK_MS = 5000;
const UNMOUNT_DELAY_MS = 500;

let finished = false;
const pendingGates = new Set(['animation', 'react', 'main']);

const tryFinishStartup = () => {
  if (finished || pendingGates.size > 0) return;
  finished = true;
  document.body.classList.add(APP_STARTUP_READY_CLASS);
  window.setTimeout(() => document.getElementById('loading')?.remove(), UNMOUNT_DELAY_MS);
};

const settleGate = (id: (typeof pendingGates) extends Set<infer T> ? T : never) => {
  if (finished) return;
  pendingGates.delete(id);
  tryFinishStartup();
};

// 门禁一：壳弹出动画（reduced-motion 或元素缺失时直接放行）
const startupLogoShell = document.querySelector('.startup-logo-shell');
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !startupLogoShell) {
  settleGate('animation');
} else {
  startupLogoShell.addEventListener('animationend', () => settleGate('animation'), { once: true });
  window.setTimeout(() => settleGate('animation'), ANIMATION_FALLBACK_MS);
}

// 门禁二：React 首帧 commit（含兜底，React 侧事件见 4.4）
window.addEventListener(APP_REACT_STARTUP_READY_EVENT, () => settleGate('react'), { once: true });
window.setTimeout(() => settleGate('react'), REACT_FALLBACK_MS);

// 门禁三：主进程就绪（先拉后推，先到信号不丢；就绪源见 4.6）
const bridge = (window as Window & { api?: { startup?: StartupBridgeLike } }).api?.startup;
if (!bridge) {
  settleGate('main'); // 无 preload 桥的异常环境不阻塞壳
} else {
  bridge.getSnapshot().then((snapshot) => {
    if (snapshot.mainReady) settleGate('main');
  });
  window.addEventListener(APP_STARTUP_MAIN_READY_EVENT, () => settleGate('main'), { once: true });
  window.setTimeout(() => settleGate('main'), MAIN_FALLBACK_MS);
}
```

行为契约：

- **门禁注册表**：`pendingGates` 为待齐备门禁集合，任一门禁经"信号 / 拉取 / 兜底超时"任一路径 settle，全部 settle 才触发显形；新增就绪源 = 加一个集合成员 + 一段注册代码 + 一个兜底常量，零结构改动（D9）。
- **幂等**：`finished` 标志保证 `app-startup-ready` 只会添加一次；门禁触发顺序无关；`{ once: true }` + 兜底定时器多路径安全（StrictMode 重复派发亦无害）。
- **物理退场**：交叉淡入启动后 500ms 将 `#loading` 从 DOM 移除（`remove()`，非隐藏）。
- **降级路径**：`prefers-reduced-motion: reduce` 或壳元素缺失时，动画门禁直接放行（此时 CSS 亦静态显示壳，用户仅失去弹出动画）。
- **主进程门禁先到不丢**：主进程信号常态早于窗口创建（闩锁 + 快照拉取命中），`getSnapshot()` 即 settle；DOM 事件与 5s 兜底分别承接"晚到信号"与"桥异常"场景；无 preload 桥的环境（如裸 file:// 打开）立即放行，不阻塞壳。

### 4.4 React 首帧提交通知器（`StartupReadyNotifier`）

文件：`packages/renderer/src/components/startup/StartupReadyNotifier/index.tsx`（一组件一文件夹；`startup/` 目录：引导期横切组件，不归属任何业务 `features/`）。作为 React 树内组件，必须遵循仓库统一的 7 段式组件模板（10 处注释锚点），`_ComponentName` 原型 + `memo` 包装 + 具名/默认双导出。v2 起事件名与提交标记键名从 shared 契约导入（v1 的"两端字符串耦合"技术债消除）：

```tsx
import { memo, useEffect } from 'react';
import {
  APP_REACT_COMMIT_AT_KEY,
  APP_REACT_STARTUP_READY_EVENT,
} from '@app/shared/constants/startup';

// 私有常量

// 可抽离的逻辑处理函数/组件

const _StartupReadyNotifier = (_props: IProps) => {
    // 变量声明、解构

    // 组件状态

    // 网络IO

    // 数据转换

    // 逻辑处理函数

    // 组件Effect
    useEffect(() => {
        window[APP_REACT_COMMIT_AT_KEY] = Date.now();
        performance.mark('app:react-commit');
        window.dispatchEvent(new Event(APP_REACT_STARTUP_READY_EVENT));
    }, []);

    // 组件渲染
    return null;
};

// props 类型定义
type IProps = Record<string, never>;

declare global {
    interface Window {
        [APP_REACT_COMMIT_AT_KEY]?: number;
    }
}

const StartupReadyNotifier = memo(_StartupReadyNotifier);
export { StartupReadyNotifier };
export default StartupReadyNotifier;
```

挂载点：`packages/renderer/src/main.tsx`，作为 `<App />` 的前置兄弟节点（与 v1 一致，不变）。

行为契约：`useEffect` 触发时机即 React 首帧 commit 完成点（`return null` 不产生任何视觉输出）；StrictMode 开发态双重触发由协调器幂等性吸收。`declare global` 的键名用常量计算属性——若 TS 版本对常量索引签名报错，回退为字面量键 + `satisfies` 断言与常量对齐（实现时择一，两端同源不改）。

### 4.5 启动耗时埋点（最小集）

渲染端维持 v1 两处：`window[APP_REACT_COMMIT_AT_KEY]`（等价上游 T5 `reactCommit`）与 `performance.mark('app:react-commit')`。v2 新增主进程侧最小集（§4.6 payload 的 `initMs` / `latchedAt`），随就绪信号被动携带，不建上报通道。上游 T0–T6 全量表见第 3 节源码索引，未来扩表时按需增补。

### 4.6 主进程就绪源（`app-startup-main-ready`，D9）

新增文件：`packages/main/src/modules/startup-readiness.module.ts`，ModuleRunner 链位在 IPC 模块之后、WindowManager 之前（保证信号先于窗口与壳）：

- **闩锁**：`enable()` 时记录 `initMs`（`performance.now()`，主进程启动为锚）与 `latchedAt`，置 `mainReady: true`；链位保证此时尚无任何窗口。
- **拉取**：`ipcMain.handle(STARTUP_GET_SNAPSHOT)` 返回闩锁快照 `StartupGateSnapshot`；preload 在求值时（早于页面一切脚本）调用，先到的信号经快照补发，不丢。
- **推送**：`broadcast(STARTUP_EVENT_MAIN_READY, payload)`（复用 config 的广播助手）；此刻无窗口属预期空操作，契约对后续创建的窗口与晚到门禁成立。

shared 契约新增：

- `packages/shared/src/constants/startup.ts`：`APP_STARTUP_READY_CLASS` / `APP_REACT_STARTUP_READY_EVENT` / `APP_STARTUP_MAIN_READY_EVENT` / `APP_REACT_COMMIT_AT_KEY`（SCREAMING_SNAKE，JSDoc 标注两端耦合关系）。
- `packages/shared/src/types/startup.ts`：`StartupMainReadyPayload { initMs: number; latchedAt: number }`、`StartupGateSnapshot { mainReady: boolean; payload: StartupMainReadyPayload | null }`。
- `packages/shared/src/constants/ipc-channels.ts` 增补：`STARTUP_GET_SNAPSHOT: 'startup:get-snapshot'`、`STARTUP_EVENT_MAIN_READY: 'startup:event:main-ready'`。

preload（`packages/preload/src/index.ts`）在**求值时**（早于页面一切脚本）即完成"先拉后推"布线：

- **快照预取**：`invoke(STARTUP_GET_SNAPSHOT)` 的 Promise 在求值期创建，`api.startup.getSnapshot()` 返回该预取 Promise（非壳等待的往返 RPC，§6.3 修订后允许）。
- **推送监听**：`ipcRenderer.on(STARTUP_EVENT_MAIN_READY)` 在求值期注册，**不等** `onMainReady` 被调用——收到推送时向共享 `window` EventTarget 派发无 payload 的 `new Event(APP_STARTUP_MAIN_READY_EVENT)`（contextIsolation 下纯 Event 跨世界可见）并分发给已注册回调。此布线保证"晚到信号"的 DOM 事件腿真实可达，而非依赖调用方先订阅。
- `onMainReady?(cb: (payload: StartupMainReadyPayload) => void): () => void`——payload 订阅接口（可选性沿用 `config.onChanged` 先例）；壳协调器只消费 DOM 事件，不消费 payload。

§6.3 红线修订（v2）：壳期**禁止**的是"壳显形依赖一次主进程往返应答"的同步耦合；**允许**引导期一次性快照拉取与单向订阅推送，且事件源必须闩锁（先到信号经拉取补发）。就绪判定仍以渲染端闭环为骨架（事件 + 兜底超时），主进程信号迟到/缺席时壳永不被卡死。

### 4.7 构建期内联插件（`build/vite-plugin-startup-shell.ts`，D8）

新增文件：`build/vite-plugin-startup-shell.ts`，导出 `startupShellInlinePlugin(): Plugin`，接入 `packages/renderer/vite.config.ts` 的 `plugins` 数组。职责与实现约束：

- **单一钩子**：`transformIndexHtml` 同时服务 dev 与 build（已核实 Vite 8.3 dev 对真实磁盘入口生效，§10.5），两形态一致。
- **Logo 替换**：读取 `packages/renderer/public/favicon.svg`（与站点 favicon 同素材）原文（剥除 XML 声明与注释）替换 `<!-- __APP_STARTUP_LOGO__ -->`；按 mtime 缓存。
- **协调器编译**：以程序化 Vite `build()` 内存打包——`inlineConfig = { configFile: false, logLevel: 'silent', plugins: [], resolve.tsconfigPaths: true, build: { write: false, rollupOptions: { input: coordinator.ts, output: { format: 'iife' } } } }`（`rollupOptions` 为 Vite 8 兼容键，等价 `rolldownOptions`），取 `output[0].code` 包裹为 `<script>...</script>` 替换 `<!-- __APP_STARTUP_COORDINATOR__ -->`；按入口与 shared constants 目录文件 mtime 缓存。替换一律用函数形式（注入内容含 `$&`/`$'` 等模式串时字符串替换会被特殊展开）。**工具链红线（D10）**：仅用 Vite 8 / Rolldown / Oxc 原生能力，禁止引入 esbuild / babel（`transformWithOxc` 为单文件转译、不打包，不满足 import shared 的需求，故取 build API 路径）。
- **入口隔离与 fail-fast**：仅主入口接壳（`ctx.filename` 归一化 + 大小写不敏感比较；`updater.html` 原样放行）；协调器打包失败、占位符缺失或替换未完成时抛错终止构建（壳是首屏生命线，静默降级等于白屏），错误信息指向本规范。

---

## 5. 非功能需求（规格冻结表）

以下数值为验收基准，与上游逐项对齐，**修改需经评审**：

| 参数 | 冻结值 | 出处（上游 @ `29628c9`） |
| :--- | :--- | :--- |
| `#root` / `#loading` 过渡时长 | `0.16s ease`（交叉淡入） | index.html L18 / L32 |
| 弹出动画时长与曲线 | `0.72s cubic-bezier(0.22, 1, 0.36, 1) forwards` | index.html L54 |
| 关键帧序列（scale） | 0%:`0.72` / 38%:`1.045` / 58%:`0.985` / 76%:`1.008` / 100%:`1` | index.html L74-97 |
| `#loading` z-index | `2147483647` | index.html L28 |
| 壳卡片规格 | 96×96、`border-radius: 24px`、渐变 `#000000 → #151718`、描边 `rgba(255,255,255,0.1)` 1px | index.html L40-66 |
| Logo 插槽规格 | 56×56（容器冻结；素材后续替换） | index.html L68-72 |
| 动画门禁兜底 | `1000ms` | index.html L182 |
| React 门禁兜底 | `3000ms` | index.html L186 |
| 壳 DOM 卸载延迟 | `500ms` | index.html L155 |
| 主进程门禁兜底 | `5000ms` | 本规范 v2 §4.3（D9 新增门禁） |
| 重绘二次补绘间隔 | `32ms`（立即一次 + 32ms 一次） | desktopWindowChrome.ts L241-250 |
| 窗口底色（深/浅） | `#141414` / `#ffffff`（与 WCO overlay 同源） | 本仓 `titlebar-overlay.ts` L28-34 |

---

## 6. 架构约束与红线

1. **壳产物自足红线（v2 修订）**：构建**产物**中，启动壳（样式 + Logo + 协调器 IIFE）必须完整内联于 index.html，运行时零打包产物依赖、零网络资源；**源码**层面协调器与 Logo 允许外置（D8），协调器 import 面仅限 `@app/shared/constants/*` 纯常量，严禁引用打包产物、组件、样式。
2. **裸 DOM 引导层豁免边界**：index.html 内联产物对应的引导层源码（`src/startup/coordinator.ts`）与壳 DOM 属于"React 引导前的裸 DOM 引导层"，豁免 7 段式模板与 manual-only Hook 约束；该豁免不覆盖 React 树内组件（含 `StartupReadyNotifier`，必须完整遵循 7 段式与注释锚点留存）。
3. **壳期 IPC 边界（v2 修订）**：就绪判定以渲染端闭环为骨架（DOM 事件 + 兜底超时），严禁壳显形依赖主进程**往返应答**；允许引导期一次性快照拉取（`startup:get-snapshot`）与单向订阅推送（`startup:event:main-ready`），事件源必须闩锁（先到信号经拉取补发）；主进程严禁为壳新增任何阻塞逻辑。
4. **显示零阻塞**：`ready-to-show` 门禁废除后**不得回潮**；任何"等业务初始化完成再显示窗口"的重构都违反本规范。主进程前序模块（`ModuleRunner` 链）不得因本规范新增同步耗时。
5. **底色单一事实源**：窗口 `backgroundColor` 与 WCO overlay 色共用 `titlebar-overlay.ts` 一处事实源，出现第二处硬编码色值即违规。
6. **重绘守护常驻**：`attachWindowsWindowRepaint` 全生命周期挂载不得移除；事件名必须是 `'resized'`（严禁 `'resize'`）；双判空守卫不得省略。
7. **入口隔离**：本规范一切产物仅作用于 `index.html` 主入口，`updater.html` 及其入口链路保持零改动。
8. **工具链时代红线（v2 新增）**：构建期转换一律使用 Vite 8 / Rolldown / Oxc 原生能力，禁止引入 esbuild / babel 等旧工具链依赖（存量 `@rolldown/plugin-babel` 仅限 lingui 既有用途，不扩用）。规则成文于 CONTRIBUTING 与 ADR-0002。

---

## 7. 自动化测试与验收标准（机械可验）

### e2e 断言（Playwright `_electron.launch` 既有夹具）

新增 `e2e/first-screen.spec.ts`：

| # | 断言 |
| :--- | :--- |
| AC-1 | 应用窗口加载完成后 `body` 含 `app-startup-ready`（3000ms 兜底界内达成） |
| AC-2 | `app-startup-ready` 出现后 ≤1000ms，`document.getElementById('loading')` 为 `null` |
| AC-3 | `window.__APP_REACT_COMMIT_AT__` 存在且为正数 |
| AC-4 | 稳定后 `getComputedStyle(document.getElementById('root')).opacity === '1'` |
| AC-5 | Updater 窗口 DOM 中不存在 `#loading`（入口隔离回归） |
| AC-6 | 既有 `titlebar.spec.ts` / `dialog.spec.ts` / `settings.spec.ts` / `updater.spec.ts` 全绿（WCO 与窗口行为回归） |
| AC-7 | 主进程就绪快照已闩锁：`window.api.startup.getSnapshot()` 返回 `mainReady === true` 且 `payload.initMs` 为正数（v2，D9） |

> 时序断言刻意只锁"最终态 + 兜底上界"（D7），0.72s / 160ms / 500ms 的精确节奏不做 e2e 硬断言。

### 代码规范验收

- `StartupReadyNotifier.tsx` 具备全部 10 处注释锚点，`memo` 包装 + 双导出；
- 主进程新增/修改文件通过 typecheck 与 Biome lint，无未使用导出；
- `index.html` 内联层无任何对外部资源的引用（grep `http(s)://`、`import`、`href=` 仅允许 favicon）。

### 人工目测清单（勾选结果记录于 PR 描述）

- [ ] 冷启动：窗口立即出现，主题底色先于壳 ≤1 帧，全程无白闪；
- [ ] 深色 / 浅色两种主题下窗口底色分别为 `#141414` / `#ffffff`，壳卡片均清晰可读；
- [ ] Logo 弹簧动画节奏正确（0.72s，一次过冲两次回弹）；
- [ ] 交叉淡入无跳变、无闪烁，主界面透出后壳不可见；
- [ ] 加载期按住窗口空白处可拖拽；
- [ ] 最大化状态启动时无可视尺寸跳变；
- [ ] Windows：跨屏拖拽、Snap 贴靠、锁屏唤醒后无黑边残影；
- [ ] 系统开启"减弱动态效果"（reduced motion）时壳静态显示、直接淡入；
- [ ] Updater 下载弹窗行为不受影响。

---

## 8. 实施文件清单与阶段划分

| 文件 | 动作 | 内容 |
| :--- | :--- | :--- |
| `packages/main/src/modules/window/index.module.ts` | 修改 | 4.1.1~4.1.5：删 `show:false` 与 ready-to-show 块、maximize 前置、dom-ready show/focus/devTools、`backgroundColor`、挂载重绘守护 |
| `packages/main/src/modules/window/titlebar-overlay.ts` | 修改 | 4.1.5：新增 `getWindowBackgroundColor()` |
| `packages/main/src/modules/window/window-repaint.ts` | 新增 | 4.1.7：`attachWindowsWindowRepaint` |
| `packages/renderer/index.html` | 修改 | 4.2 / 4.3：壳 + 内联协调器 |
| `packages/renderer/src/components/startup/StartupReadyNotifier.tsx` | 新增 | 4.4 / 4.5 |
| `packages/renderer/src/main.tsx` | 修改 | 4.4：挂载 Notifier |
| `e2e/first-screen.spec.ts` | 新增 | AC-1~AC-5 |

**v2 追加清单**（v1 清单为已完成记录，保留不动）：

| 文件 | 动作 | 内容 |
| :--- | :--- | :--- |
| `build/vite-plugin-startup-shell.ts` | 新增 | 4.7：`startupShellInlinePlugin`（Logo 内联 + 协调器内存打包） |
| `packages/shared/src/constants/startup.ts` | 新增 | 4.6：就绪契约常量 |
| `packages/shared/src/types/startup.ts` | 新增 | 4.6：`StartupMainReadyPayload` / `StartupGateSnapshot` |
| `packages/shared/src/constants/ipc-channels.ts` | 修改 | 4.6：`STARTUP_GET_SNAPSHOT` / `STARTUP_EVENT_MAIN_READY` |
| `packages/main/src/modules/startup-readiness.module.ts` | 新增 | 4.6：主进程就绪闩锁 + 快照/推送 |
| `packages/main/src/index.ts` | 修改 | 4.6：链位接入（IPC 之后、WindowManager 之前） |
| `packages/preload/src/index.ts` | 修改 | 4.6：`api.startup` 先拉后推桥接 |
| `packages/renderer/src/startup/coordinator.ts` | 新增 | 4.3：门禁注册表协调器源码 |
| `packages/renderer/src/assets/startup-logo.svg` | 新增 | 4.2：Logo 插槽源文件（Header 同款蓝底白雷电；换素材只改此文件） |
| `packages/renderer/index.html` | 修改 | 4.2：协调器/Logo 缩为占位符 |
| `packages/renderer/src/components/startup/StartupReadyNotifier/index.tsx` | 修改 | 4.4：契约常量改为 shared 导入 |
| `.config/biome.json` | 修改 | 4.2：`noImportantStyles` 文件级 override（HTML 内不再放抑制注释） |
| `e2e/first-screen.spec.ts` | 修改 | 4.6：AC-7 主进程就绪快照断言 |

| 阶段 | 内容 | 对应 |
| :--- | :--- | :--- |
| Phase 1 | 主进程窗口时序、底色、重绘守护 | 4.1 |
| Phase 2 | 壳与内联协调器 | 4.2、4.3 |
| Phase 3 | Notifier 挂载与埋点 | 4.4、4.5 |
| Phase 4 | e2e 用例 + 人工清单全量验收 | 第 7 节 |
| Phase 5 | Logo 真实素材替换（**已完成**：Header 同款蓝底白雷电落地于 `src/assets/startup-logo.svg`，2026-10-05） | 4.2 插槽 |
| Phase 6（v2） | 壳资产源码外置 + 构建期内联 + 主进程就绪源 + 门禁注册表 | 4.2~4.7，D8~D10 |

---

## 9. 建议提交顺序

v1 的 1~5 已按序落库（`feat/first-screen-loading`）。v2 追加：

6. `docs(specs): 首屏规范升版 v2——构建期内联与门禁注册表，新增 ADR-0002/0003 与工具链时代规则`
7. `feat(shared): 启动就绪契约常量、类型与 IPC 通道入库`
8. `feat(build): 新增 startup-shell 构建期内联插件，协调器与 Logo 源码外置、index.html 缩为占位符`
9. `feat(main): ModuleRunner 链接入主进程就绪闩锁，preload 先拉后推桥接`
10. `test(e2e): 新增主进程就绪快照断言并全量回归`

---

## 10. 未决问题

1. ~~**Logo 真实素材未定**：插槽与容器规格已冻结，素材到位后作为独立提交替换占位 SVG（Phase 5）。~~ **【已解决】素材为 Header 同款蓝底白雷电（`src/assets/startup-logo.svg`），Phase 5 完成。**
2. 无其他未决项；实现过程中的新问题回填本节。
3. **【已解决】协调器脚本标签为经典 `<script>`（非 `type="module"`）**：实现时实测发现 Vite 8 构建会把内联 module script 抽进主 bundle（`dist/index.html` 内联 module script 数为 0，协调器被合并进 `assets/main-*.js`），恰触发 D3 红线（bundle 解析超 720ms 丢动画事件）。经典内联脚本 Vite 原样保留在产物 HTML 中，且在解析位同步执行、先于 defer 的 main.tsx，时序保证更强，故替代 module 内联；D3 的其余论证不变。
4. **【已解决】组件路径与 props 类型微调**：Notifier 按仓库「一组件一文件夹」无条件规则（renderer README §组件书写约定）落为 `startup/StartupReadyNotifier/index.tsx`；props 类型沿用 App.tsx 无 props 先例写作 `type IProps = Record<string, never>`，并以 `(_props: IProps)` 形参消费（否则 `noUnusedLocals` 报 TS6196）。两者语义与冻结代码等价。
5. **【已解决·v2】dev 下 transformIndexHtml 生效性**：读 Vite 8.3 源码实锤——indexHtmlMiddleware 对 `fs.existsSync` 为真的磁盘入口必过 `transformIndexHtml`（dev/build 同一插件形态的依据）；此前"dev html 不走插件管线"的坑仅适用于磁盘不存在的虚拟入口。另 full-bundle 实验模式不调该钩子，本仓未启用。
6. **【已解决·v2】协调器打包 API 选型**：`transformWithOxc` 为单文件转译、不打包 import（无法吸收 shared 常量）；Vite 8 不 re-export rolldown 本体。定选程序化 `build()`（`configFile:false` + `write:false` + `format:'iife'`）内存打包，零新增依赖（D10）。
7. **【已解决·v2】contextIsolation 下的快照载体**：preload 直接写 `window.xxx` 主世界不可见（隔离世界），"window 快照对象"不可行；定选 contextBridge API（`api.startup.getSnapshot()` 拉取 + `onMainReady` 回调携带 payload）+ 无 payload 纯 `Event` 跨世界派发（`APP_STARTUP_MAIN_READY_EVENT`）。
