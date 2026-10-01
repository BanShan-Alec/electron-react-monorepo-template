# Electron 首屏渐进式无缝加载规范 (First Screen Loading Spec)

> 版本：v1 | 状态：设计定稿，待实现
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
| 协调器位置 | index.html 内联 `<script type="module">` | 同（**禁止**抽成独立模块，见 D3） |

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

改动文件：`packages/renderer/index.html`。目标形态（完整冻结，占位注释除外）：

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>renderer</title>
    <style>
      html,
      body,
      #root {
        margin: 0;
        width: 100%;
        height: 100%;
        background: transparent !important;
      }

      #root {
        opacity: 0;
        transition: opacity 0.16s ease;
      }

      body.app-startup-ready #root {
        opacity: 1;
      }

      /* 拖拽必须写在内联样式块：Tailwind content 仅扫描 ./src/**，
         任意属性类 [app-region:drag] 在本文件中不会生成产物 */
      #loading {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.16s ease;
        -webkit-app-region: drag;
      }

      body.app-startup-ready #loading {
        pointer-events: none;
        opacity: 0;
      }

      .startup-logo-shell {
        position: relative;
        display: flex;
        width: 96px;
        height: 96px;
        align-items: center;
        justify-content: center;
        border-radius: 24px;
        background: linear-gradient(180deg, #000000 0%, #151718 100%);
        box-shadow:
          0 20px 25px -5px rgb(0 0 0 / 0.25),
          0 8px 10px -6px rgb(0 0 0 / 0.25);
        transform: scale(0.72);
        opacity: 0;
        animation: startup-logo-pop 0.72s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        transform-origin: center;
      }

      .startup-logo-shell::before {
        position: absolute;
        inset: 0;
        pointer-events: none;
        content: '';
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: inherit;
      }

      .startup-logo-slot {
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      @keyframes startup-logo-pop {
        0% {
          opacity: 0;
          transform: scale(0.72);
        }
        38% {
          opacity: 1;
          transform: scale(1.045);
        }
        58% {
          transform: scale(0.985);
        }
        76% {
          transform: scale(1.008);
        }
        100% {
          opacity: 1;
          transform: scale(1);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .startup-logo-shell {
          opacity: 1;
          transform: scale(1);
          animation: none;
        }
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <div id="loading" role="status" aria-busy="true" aria-label="Loading...">
      <div class="startup-logo-shell">
        <div class="startup-logo-slot">
          <!-- Logo 资源插槽：素材替换属独立任务，容器规格已冻结（见第 5 节） -->
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#ffffff" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </div>
      </div>
    </div>
    <script type="module">
      // 4.3 就绪协调器（源码见下），必须物理位于 main.tsx 之前
    </script>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

硬性约束：

1. **零外部依赖**：壳不得引用任何打包产物（外部 JS/CSS、字体、图片、Tailwind 工具类、antd 变量）。所有样式与逻辑内联自足。
2. **脚本顺序**：内联协调器 `<script type="module">` 必须物理位于 `<script src="/src/main.tsx">` 之前。依据见 D3。
3. **拖拽写法**：`-webkit-app-region: drag` 写在内联 `<style>` 中。**禁止**使用 Tailwind 任意属性类 `[app-region:drag]`——`tailwind.config.ts` 的 content 仅含 `./src/**`，index.html 中的类不会生成产物。
4. `updater.html` 不做任何改动。
5. 已知开发期现象（与上游一致，接受）：dev 模式 HMR 全量刷新时壳动画会重播一次。

### 4.3 双门禁就绪协调器（index.html 内联脚本）

内联脚本内容冻结如下：

```js
{
  const READY_CLASS = 'app-startup-ready';
  const REACT_READY_EVENT = 'app-react-startup-ready';
  const ANIMATION_FALLBACK_MS = 1000;
  const REACT_FALLBACK_MS = 3000;
  const UNMOUNT_DELAY_MS = 500;

  let finished = false;
  let animationDone = false;
  let reactReady = false;

  const tryFinishStartup = () => {
    if (finished || !animationDone || !reactReady) return;
    finished = true;
    document.body.classList.add(READY_CLASS);
    window.setTimeout(() => document.getElementById('loading')?.remove(), UNMOUNT_DELAY_MS);
  };

  const markAnimationDone = () => {
    animationDone = true;
    tryFinishStartup();
  };

  const markReactReady = () => {
    reactReady = true;
    tryFinishStartup();
  };

  const startupLogoShell = document.querySelector('.startup-logo-shell');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 门禁一：壳弹出动画（reduced-motion 或元素缺失时直接放行）
  if (prefersReducedMotion || !startupLogoShell) {
    markAnimationDone();
  } else {
    startupLogoShell.addEventListener('animationend', markAnimationDone, { once: true });
    window.setTimeout(markAnimationDone, ANIMATION_FALLBACK_MS);
  }

  // 门禁二：React 首帧 commit（含兜底，React 侧事件见 4.4）
  window.addEventListener(REACT_READY_EVENT, markReactReady, { once: true });
  window.setTimeout(markReactReady, REACT_FALLBACK_MS);
}
```

行为契约：

- **幂等**：`finished` 标志保证 `app-startup-ready` 只会添加一次；两门禁触发顺序无关；`{ once: true }` + 兜底定时器双路径安全（StrictMode 重复派发亦无害）。
- **物理退场**：交叉淡入启动后 500ms 将 `#loading` 从 DOM 移除（`remove()`，非隐藏）。
- **降级路径**：`prefers-reduced-motion: reduce` 或壳元素缺失时，门禁一直接放行（此时 CSS 亦静态显示壳，用户仅失去弹出动画）。

### 4.4 React 首帧提交通知器（`StartupReadyNotifier`）

新增文件：`packages/renderer/src/components/startup/StartupReadyNotifier.tsx`（新增 `startup/` 目录：引导期横切组件，不归属任何业务 `features/`）。作为 React 树内组件，必须遵循仓库统一的 7 段式组件模板（10 处注释锚点：`// 私有常量`、`// 可抽离的逻辑处理函数/组件`、`// 变量声明、解构`、`// 组件状态`、`// 网络IO`、`// 数据转换`、`// 逻辑处理函数`、`// 组件Effect`、`// 组件渲染`、`// props 类型定义`），`_ComponentName` 原型 + `memo` 包装 + 具名/默认双导出：

```tsx
import { memo, useEffect } from 'react';

// 私有常量
const REACT_READY_EVENT = 'app-react-startup-ready';

// 可抽离的逻辑处理函数/组件

const _StartupReadyNotifier = () => {
    // 变量声明、解构

    // 组件状态

    // 网络IO

    // 数据转换

    // 逻辑处理函数

    // 组件Effect
    useEffect(() => {
        // 事件名与 index.html 内联协调器字符串耦合，两端必须同步修改
        window.__APP_REACT_COMMIT_AT__ = Date.now();
        performance.mark('app:react-commit');
        window.dispatchEvent(new Event(REACT_READY_EVENT));
    }, []);

    // 组件渲染
    return null;
};

// props 类型定义
interface IProps {}

declare global {
    interface Window {
        __APP_REACT_COMMIT_AT__?: number;
    }
}

const StartupReadyNotifier = memo(_StartupReadyNotifier);
export { StartupReadyNotifier };
export default StartupReadyNotifier;
```

挂载点：`packages/renderer/src/main.tsx`，作为 `<App />` 的前置兄弟节点：

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <StartupReadyNotifier />
      <App />
    </AppProviders>
  </StrictMode>,
);
```

行为契约：`useEffect` 触发时机即 React 首帧 commit 完成点（`return null` 不产生任何视觉输出）；StrictMode 开发态双重触发由协调器幂等性吸收。

### 4.5 启动耗时埋点（最小集）

仅纳入 4.4 代码中的两处：`window.__APP_REACT_COMMIT_AT__`（等价上游 T5 `reactCommit`）与 `performance.mark('app:react-commit')`。供 e2e 断言与 DevTools Performance 面板读取，**不建上报通道**。上游 T0–T6 全量表见第 3 节源码索引，未来扩表时按需增补。

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
| 重绘二次补绘间隔 | `32ms`（立即一次 + 32ms 一次） | desktopWindowChrome.ts L241-250 |
| 窗口底色（深/浅） | `#141414` / `#ffffff`（与 WCO overlay 同源） | 本仓 `titlebar-overlay.ts` L28-34 |

---

## 6. 架构约束与红线

1. **壳自足红线**：启动壳（4.2）与就绪协调器（4.3）只允许存在于 `index.html` 内联层，严禁拆分为依赖打包产物的模块，严禁引入任何网络资源。
2. **裸 DOM 引导层豁免边界**：index.html 内联脚本与壳 DOM 属于"React 引导前的裸 DOM 引导层"，豁免 7 段式模板与 manual-only Hook 约束；该豁免仅覆盖 index.html 内联代码——任何进入 React 树的组件（含 `StartupReadyNotifier`）必须完整遵循 7 段式与注释锚点留存。
3. **禁壳期 IPC**：就绪判定完全在渲染端闭环（DOM 事件 + 超时兜底），严禁为壳引入主进程 IPC 往返；主进程严禁为壳新增任何阻塞逻辑。
4. **显示零阻塞**：`ready-to-show` 门禁废除后**不得回潮**；任何"等业务初始化完成再显示窗口"的重构都违反本规范。主进程前序模块（`ModuleRunner` 链）不得因本规范新增同步耗时。
5. **底色单一事实源**：窗口 `backgroundColor` 与 WCO overlay 色共用 `titlebar-overlay.ts` 一处事实源，出现第二处硬编码色值即违规。
6. **重绘守护常驻**：`attachWindowsWindowRepaint` 全生命周期挂载不得移除；事件名必须是 `'resized'`（严禁 `'resize'`）；双判空守卫不得省略。
7. **入口隔离**：本规范一切产物仅作用于 `index.html` 主入口，`updater.html` 及其入口链路保持零改动。

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

| 阶段 | 内容 | 对应 |
| :--- | :--- | :--- |
| Phase 1 | 主进程窗口时序、底色、重绘守护 | 4.1 |
| Phase 2 | 壳与内联协调器 | 4.2、4.3 |
| Phase 3 | Notifier 挂载与埋点 | 4.4、4.5 |
| Phase 4 | e2e 用例 + 人工清单全量验收 | 第 7 节 |
| Phase 5 | Logo 真实素材替换（**挂起**：待素材提供，插槽规格已冻结） | 4.2 插槽 |

---

## 9. 建议提交顺序

1. `docs(specs): 新增首屏渐进式加载规范与 ADR-0001 窗口材质裁决`
2. `feat(window): 废除 ready-to-show 门禁并对齐窗口主题底色与无边框重绘守护`
3. `feat(renderer): 注入内联启动壳与双门禁就绪协调器`
4. `feat(renderer): 接入 StartupReadyNotifier 并埋设 React 首帧提交标记`
5. `test(e2e): 新增 first-screen 用例并回归既有套件`

---

## 10. 未决问题

1. **Logo 真实素材未定**：插槽与容器规格已冻结，素材到位后作为独立提交替换占位 SVG（Phase 5）。
2. 无其他未决项；实现过程中的新问题回填本节。
