# WCO 原生标题栏接入指南

> 面向场景：其他 Electron 项目需要"一体化标题栏"——网页内容铺满窗口、同时保留操作系统原生控制按钮（macOS 红绿灯 / Windows 最小化-最大化-关闭），并支持主题联动。
>
> 依据：Electron 41 `electron.d.ts` 平台标注 + VS Code 源码（`src/vs/platform/windows/electron-main/windows.ts` 的 `defaultBrowserWindowOptions`、`windowImpl.ts` 的 `updateWindowControls`）+ 本仓库 Electron 41 / Windows 11 实测。参考实现见本仓库 `packages/main/src/modules/window/titlebar-overlay.ts` 等文件。

---

## 1. 核心平台契约（先记住这张表）

| 事项 | darwin | win32 | linux |
|---|---|---|---|
| `titleBarStyle: 'hidden'` | ✅ 保留红绿灯 | ✅ 需要 | 可选 |
| `frame: false` | ❌ 不要加 | ✅ **必须**，否则 overlay 不生效 | 与 WCO 方案配套 |
| `titleBarOverlay` 传法 | **布尔 `true`**（仅启用 JS API 与 CSS `env()`） | **对象** `{ color, symbolColor, height? }` | 对象（桌面环境差异大，保守可不做） |
| `color` / `symbolColor` | ❌ 无效（`@platform win32,linux`） | ✅ | ✅ |
| 运行时 `setTitleBarOverlay()` | ❌ 会抛错 | ✅ | ✅ |
| 红绿灯/按钮外观 | 系统管理（`setWindowButtonPosition` 可调位置） | overlay 绘制 | overlay 绘制 |

三条铁律，违反必踩坑：

1. **`setTitleBarOverlay` 要求窗口创建时就启用了 overlay**，否则抛 `TypeError: Titlebar overlay is not enabled`；
2. **Windows 上 `titleBarStyle: 'hidden'` 单独不够**，必须配 `frame: false`（`thickFrame` 默认 `true`，窗口阴影与边缘缩放不受影响）；
3. **macOS 上 `color`/`symbolColor` 和运行时更新都无效/会炸**，红绿灯外观只能由系统管理。

`height` 字段：缺省取系统标题栏高度。除非设计强依赖固定条高（VS Code 钉 29px，注释为 "smallest size of the title bar on windows accounting for the border on windows 11"，且运行时更新传 `height - 1` 补偿窗口边框），否则**建议不传**。

---

## 2. 接入步骤

### Step 1：窗口创建（主进程）

按平台分支构造选项，linux 保持默认边框（最保守做法）：

```ts
import { BrowserWindow } from 'electron';

// overlay 颜色单一事实源（见 Step 2），此处仅示意
const browserWindow = new BrowserWindow({
  show: false,
  // ...位置尺寸
  ...(process.platform === 'darwin'
    ? { titleBarStyle: 'hidden', titleBarOverlay: true }
    : process.platform === 'win32'
      ? {
          titleBarStyle: 'hidden',
          frame: false,
          titleBarOverlay: getTitleBarOverlayOptions(),
        }
      : {}),
  webPreferences: { /* ... */ },
});
```

**多窗口应用**：参照 VS Code，在每个窗口创建处捕获 `const hasWindowControlOverlay = !!options.titleBarOverlay`，后续运行时更新前先判断，而不是裸调 API。

### Step 2：主题联动（主进程）

新建单一事实源模块，供窗口创建与主题模块共享，避免颜色映射散落多处：

```ts
// titlebar-overlay.ts
import { nativeTheme } from 'electron';

const IS_WIN = process.platform === 'win32';

/** 仅 win32 创建时启用了对象形态 overlay，运行时更新仅对其有意义 */
export function canUpdateTitleBarOverlay(): boolean {
  return IS_WIN;
}

/** 颜色必须与渲染层设计 token 对齐（浅色容器底色 + 主文字色） */
export function getTitleBarOverlayOptions() {
  const dark = nativeTheme.shouldUseDarkColors;
  return {
    color: dark ? '#141414' : '#ffffff',
    symbolColor: dark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.88)',
  };
}
```

在 `nativeTheme` 模块里挂钩，覆盖两条路径：应用内主题切换（`themeSource` 变更会触发 `updated`）与系统主题漂移：

```ts
nativeTheme.on('updated', () => {
  if (!canUpdateTitleBarOverlay()) return; // darwin 调用必炸
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try {
      win.setTitleBarOverlay(getTitleBarOverlayOptions());
    } catch {
      // 该窗口创建时未启用 overlay，跳过
    }
  }
});
```

要点：

- `setTitleBarOverlay` 是 **per-window** 的，多窗口要逐个更新；
- `symbolColor` 按背景明暗取黑/白保证对比度（VS Code 用 `Color.isDarker()` 判断），纯硬编码白色在浅色主题下会看不见；
- 若应用主题不止 light/dark 二态（自定义品牌色板），`nativeTheme.on('updated')` 不够，需要渲染层 → IPC → 主进程逐窗口更新（VS Code 的 themeMain 即此模式）。

### Step 3：平台类名注入（preload + 渲染层）

CSS 平台避让需要一个"当前平台"信号。**推荐：preload 暴露同步方法，渲染层自行加类名**——主进程不跨世界操作 DOM：

```ts
// preload
contextBridge.exposeInMainWorld('api', {
  system: {
    getPlatform: () => process.platform, // 同步，不走 IPC
  },
});
```

```ts
// 渲染层 hook，在根 Provider 中调用一次
export function usePlatform() {
  useEffect(() => {
    document.documentElement.classList.add(`platform-${window.api.system.getPlatform()}`);
  }, []);
}
```

反面教材：主进程用 `webContents.executeJavaScript` 注入类名——主进程被迫知道渲染层 DOM 结构，且时机难以保证。

### Step 4：CSS 避让（渲染层）

```css
/*
 * 原则：左右避让交给 env()，头部高度交给内容。
 * 不要写 height: env(titlebar-area-height, 35px) —— overlay 条高只是
 * 原生控件那一小条的高度，强制套在整个 header 上会压扁多行内容。
 */
.platform-darwin .app-header {
  /* env 由 titleBarOverlay: true 提供；回退值按红绿灯实际宽度给（约 70~80px），
     写 12px 的小回退会在 env 不可用时让内容穿到红绿灯底下 */
  padding-left: env(titlebar-area-x, 80px);
}

.platform-win32 .app-header {
  /* 扣除右上角原生控制按钮宽度 */
  padding-right: calc(100vw - env(titlebar-area-width, 100vw));
}

/* 标题栏区域可拖拽，内部交互元素必须豁免 */
.app-header { -webkit-app-region: drag; }
.app-header input,
.app-header button { -webkit-app-region: no-drag; }
```

免费福利：macOS 进全屏时系统自动把红绿灯移走，`env(titlebar-area-x)` 自动归零，无需任何 JS 监听。

### Step 5：e2e 验证

`navigator.windowControlsOverlay` 是**验证 overlay 是否真正生效的唯一可靠手段**，以运行时探测为准，不要背版本号：

```ts
// 注意：Electron 41 的方法名是 getTitlebarAreaRect()，
// 旧版 W3C 规范草案的 getTitlebarArea() 并不存在
const wco = (navigator as Navigator & {
  windowControlsOverlay?: {
    visible: boolean;
    getTitlebarAreaRect(): { x: number; y: number; width: number; height: number };
  };
}).windowControlsOverlay;

// win32 断言
expect(wco?.visible).toBe(true);
expect(parseFloat(getComputedStyle(header).paddingRight)).toBeGreaterThan(0);
// 头部保持内容自然高度（防被 overlay 条高压扁）
expect(parseFloat(getComputedStyle(header).height)).toBeGreaterThan(40);
```

另外 `wco.addEventListener('geometrychange', ...)` 可响应最大化/全屏等几何变化。

---

## 3. 已知坑清单（本仓库实测踩过）

| 坑 | 现象 | 根因 / 解法 |
|---|---|---|
| overlay 未启用 | 运行时 `setTitleBarOverlay` 抛 `Titlebar overlay is not enabled` | win32 缺 `frame: false`，或该窗口创建时就没传 `titleBarOverlay`；调用前加平台/能力守卫 |
| mac 上主题切换报错 | 红绿灯相关调用异常 | `setTitleBarOverlay` 是 `@platform win32,linux`；darwin 分支直接 return |
| 高 DPI 错位 | 125%/150% 缩放下 1px 缝隙 | 用了硬编码 padding；改用 `env()` |
| 头部被压扁 | 双行标题被裁掉 | CSS 强制 `height: env(titlebar-area-height)`；删掉，高度交给内容 |
| 多窗口漏更新 | 部分窗口标题栏颜色不随主题 | 只更新了一个 win；遍历 `BrowserWindow.getAllWindows()` |
| e2e 全量误跑 | `pnpm test:e2e -- --grep x` 全量跑 | pnpm 把 `--` 原样透传，grep 失效；去掉 `--` 直接传参 |

---

## 4. 接入检查清单

- [ ] darwin：`titleBarStyle: 'hidden'` + `titleBarOverlay: true`，无 `frame: false`
- [ ] win32：`titleBarStyle: 'hidden'` + `frame: false` + overlay 颜色对象
- [ ] linux：明确决策——默认边框（保守）或 WCO（环境差异自负）
- [ ] overlay 颜色与渲染层设计 token 同源，dark/light 两套都验证过对比度
- [ ] 运行时更新有平台守卫 + "创建时已启用"守卫 + try/catch，多窗口遍历
- [ ] `height` 要么不传（推荐），要么有明确设计依据并知晓 Win11 边框补偿
- [ ] preload 暴露同步 `getPlatform()`，渲染层 hook 注入 `platform-*` 类名
- [ ] CSS：左右避让用 `env()` 带平台合理回退值；不强制头部高度；交互元素 `no-drag`
- [ ] e2e 断言 `windowControlsOverlay.visible` 与 env 计算后的实际 padding；方法名 `getTitlebarAreaRect()`
- [ ] macOS 全屏、Windows 最大化两种状态下人工过一遍避让表现

---

## 5. 参考来源

- `node_modules/electron/electron.d.ts`（Electron 41）：`TitleBarOverlay` / `setTitleBarOverlay` 的 `@platform` 标注，是最权威的本地契约
- VS Code：`src/vs/platform/windows/electron-main/windows.ts`（创建分支）、`windowImpl.ts`（运行时更新守卫、`height - 1` 边框补偿）
- 本仓库实现：`packages/main/src/modules/window/titlebar-overlay.ts`、`index.module.ts`、`native-theme.module.ts`、`packages/renderer/src/styles/base.css`、`e2e/titlebar.spec.ts`
