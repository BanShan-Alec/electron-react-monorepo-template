# 告别上千行“面条代码”：基于 Module Runner 的 Electron 主进程架构实践

> 本文深入剖析现代 Electron 应用的主进程架构演进，介绍如何利用 **Module Runner（模块运行器）** 模式将混乱散落的主进程逻辑解耦为高内聚、可拔插、可测试的标准化模块。

---

## 1. 痛点：传统 Electron 主进程的“灾难现场”

如果你开发或维护过一段时间的 Electron 项目，大概率见过类似这样的 `main/index.ts`：

```ts
// ❌ 典型的“上帝文件”（God File）反模式
import { app, BrowserWindow, ipcMain, Tray, Menu } from 'electron';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// 1. 散落各处的初始化配置
app.disableHardwareAcceleration();

// 2. 单例检测
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => { /* ... */ });
}

// 3. app.whenReady 内部变成“垃圾场”
app.whenReady().then(async () => {
  // 3.1 初始配置与日志
  initLogger();
  loadUserSettings();

  // 3.2 创建窗口
  mainWindow = new BrowserWindow({ /* 几十行配置 */ });
  mainWindow.loadURL(...);

  // 3.3 创建托盘
  tray = new Tray('icon.png');
  // ...一大堆右键菜单事件...

  // 3.4 散落的 IPC 监听
  ipcMain.handle('window-minimize', () => { /* ... */ });
  ipcMain.handle('get-config', () => { /* ... */ });

  // 3.5 安全拦截代码（容易遗漏）
  mainWindow.webContents.on('will-navigate', (e, url) => { /* ... */ });

  // 3.6 自动更新检查
  autoUpdater.checkForUpdatesAndNotify();
});

// 4. 平台生命周期事件穿插在各个角落
app.on('window-all-closed', () => { /* ... */ });
app.on('activate', () => { /* ... */ });
```

### 痛点剖析：
1. **职责无限膨胀（God File）**：主入口动辄上千行，窗口、托盘、快捷键、自动更新、安全规则、IPC 接口混杂在一起，任何修改都可能引发连带灾难。
2. **时序与竞态隐患（Lifecycle Hell）**：Electron 很多 API 对调用时机有极其严格的约束（例如 `disableHardwareAcceleration` 和 `requestSingleInstanceLock` 必须在 `whenReady` **前** 调用，而窗口、托盘、协议监听必须在 `whenReady` **后** 调用）。散乱的回调很容易引起偶发性白屏或崩溃。
3. **安全配置易遗漏**：如果在每个窗口创建的地方手动写安全限制，一旦新增子窗口或 webview，往往会遗漏导航审查和外链限制。
4. **无法进行单元测试**：整个文件强依赖真实的 Electron 运行时环境，核心业务逻辑与窗口胶水代码绑死，根本无法做自动化 Mock 和独立单测。

---

## 2. 破局：Module Runner 架构思想

为了解决上述问题，本项目引入了 **Module Runner（微内核 + 管道装配流水线）** 架构模式：

```
       ┌────────────────────────────────────────────────────────┐
       │                 scripts/entry-point.ts                 │
       │   抹平 DevServer / 打包产物路径差异，捕获顶层未捕获异常    │
       └───────────────────────────┬────────────────────────────┘
                                   │ initApp(initConfig)
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                packages/main/src/index.ts              │
       │                   【声明式装配流水线】                 │
       └───────────────────────────┬────────────────────────────┘
                                   │ createModuleRunner()
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        ModuleRunner 调度内核                           │
├────────────────────────────────────────────────────────────────────────┤
│  .init(createLogModule())                  --> 日志系统先行            │
│  .init(createTRPCModule())                 --> 强类型通信通道就绪      │
│  .init(createWindowManagerModule(...))     --> 窗口调度 & 状态恢复     │
│  .init(createTrayModule())                 --> 系统托盘管理            │
│  .init(disallowMultipleAppInstance())      --> 单实例互斥锁            │
│  .init(terminateAppOnLastWindowClose())    --> 退出策略                │
│  .init(hardwareAccelerationMode({enable})) --> GPU加速开关             │
│  .init(autoUpdater())                      --> 自动更新守护            │
│  .init(allowInternalOrigins(...))          --> 导航白名单安全防线      │
│  .init(allowExternalUrls(...))             --> 外部链接安全审查        │
└────────────────────────────────────────────────────────────────────────┘
```

### 核心设计哲学
- **接口即契约**：所有主进程特性都被视为一个独立的“模块（Module）”，实现统一的生命周期契约。
- **显式依赖注入**：模块不随意到处引用全局环境，而是通过上下文（Context）受控地使用 Electron 资源。
- **流式异步管道**：主入口像流水线一样把所有模块串起来，初始化顺序一目了然。

---

## 3. 深入源码：核心三件套剖析

### 3.1 统一契约：`AppModule`

代码位于 `packages/main/src/AppModule.ts`：

```ts
import type { ModuleContext } from './ModuleContext.js';

export interface AppModule {
  enable(context: ModuleContext): Promise<void> | void;
}
```

- 每一个模块只需实现 `enable` 方法。
- 返回类型允许是 `Promise<void>` 或 `void`，完美兼顾同步与异步模块的加载。

### 3.2 依赖上下文：`ModuleContext`

代码位于 `packages/main/src/ModuleContext.ts`：

```ts
export type ModuleContext = {
  readonly app: Electron.App;
};
```

- 将全局的 `app` 实例通过只读上下文传递给模块。
- 模块不直接强依赖全局状态，方便在自动化测试时传入 Mock 上下文。

### 3.3 调度执行器：`ModuleRunner`

代码位于 `packages/main/src/ModuleRunner.ts`：

```ts
import { app } from 'electron';
import type { AppModule } from './AppModule.js';
import type { ModuleContext } from './ModuleContext.js';

class ModuleRunner implements PromiseLike<void> {
  #promise: Promise<void>;

  constructor() {
    this.#promise = Promise.resolve();
  }

  // 实现 PromiseLike，使得整个 runner 可以直接被 await
  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): PromiseLike<TResult1 | TResult2> {
    return this.#promise.then(onfulfilled, onrejected as any);
  }

  // 链式调用注册模块
  init(module: AppModule) {
    const p = module.enable(this.#createModuleContext());

    // 关键：若是异步模块，按序链接入 Promise 队列，确保初始化时序确定性
    if (p instanceof Promise) {
      this.#promise = this.#promise.then(() => p);
    }

    return this;
  }

  #createModuleContext(): ModuleContext {
    return { app };
  }
}

export function createModuleRunner() {
  return new ModuleRunner();
}
```

**设计精妙点**：
- **链式建造者模式（Fluent API）**：每个 `.init()` 均返回 `this`，装配代码非常优雅简洁。
- **自动 Promise 串行调度**：通过 `this.#promise = this.#promise.then(() => p)`，如果模块 `A` 包含异步初始化，模块 `B` 会在其成功后才开始，彻底根治异步竞态。
- **自身就是 `PromiseLike`**：外部无需调用 `.run()` 或 `.execute()`，直接 `await moduleRunner` 即可等待所有模块初始化完成。

---

## 4. 实战案例：各功能模块的优雅落地

### 案例 1：声明式安全防线体系

在 Electron 应用中，渲染页面可能遭遇恶意跳转或 XSS 唤起外部应用。本项目通过抽象基类实现了“全局自动防御”：

```ts
// 抽象基类：监听所有新生成的 webContents
export abstract class AbstractSecurityRule implements AppModule {
  enable({ app }: ModuleContext): Promise<void> | void {
    app.on('web-contents-created', (_, contents) => this.applyRule(contents));
  }

  abstract applyRule(contents: Electron.WebContents): Promise<void> | void;
}
```

具体规则模块继承该基类：

```ts
// 站内跳转白名单限制
export class BlockNotAllowedOrigins extends AbstractSecurityRule {
  readonly #allowedOrigins: Set<string>;

  constructor(allowedOrigins: Set<string> = new Set()) {
    super();
    this.#allowedOrigins = structuredClone(allowedOrigins);
  }

  applyRule(contents: Electron.WebContents): void {
    contents.on('will-navigate', (event, url) => {
      const { origin } = new URL(url);
      if (!this.#allowedOrigins.has(origin)) {
        event.preventDefault(); // 阻断非法导航
        console.warn(`Blocked navigating to disallowed origin: ${origin}`);
      }
    });
  }
}
```

> **收益**：无论你在哪个地方创建了 `BrowserWindow` 或 `BrowserView`，这条安全规则都会自动生效，避免了漏配风险。

---

### 案例 2：生命周期敏感模块

有些操作必须在 `app.whenReady()` 之前，比如硬件加速禁用和单实例锁：

```ts
// packages/main/src/modules/HardwareAccelerationModule.ts
export class HardwareAccelerationModule implements AppModule {
  readonly #shouldBeDisabled: boolean;

  constructor({ enable }: { enable: boolean }) {
    this.#shouldBeDisabled = !enable;
  }

  enable({ app }: ModuleContext): void {
    if (this.#shouldBeDisabled) {
      // 必须在 ready 前调用
      app.disableHardwareAcceleration();
    }
  }
}
```

而窗口管理模块需要在 `whenReady()` 之后创建并恢复窗口：

```ts
// packages/main/src/modules/WindowManager.ts
class WindowManager implements AppModule {
  async enable({ app }: ModuleContext): Promise<void> {
    await app.whenReady();
    this.#windowStateKeeper.validateWithDisplays();
    await this.restoreOrCreateWindow(true);
    
    app.on('second-instance', () => this.restoreOrCreateWindow(true));
    app.on('activate', () => this.restoreOrCreateWindow(true));
  }
}
```

> **收益**：每个模块内部封装了自己的时序契约，外部调用者在装配时只需关注业务逻辑，心智负担极小。

---

### 案例 3：窗口状态持久化与多屏容错 (`WindowStateKeeper`)

很多 Electron 应用在用户拔掉外接屏幕后，窗口常常打开在“屏幕外看不见的区域”。本项目在 `WindowManager` 结合了 `WindowStateKeeper`：

```ts
// 启动时多显示器坐标校验
validateWithDisplays() {
  const displays = screen.getAllDisplays();
  const isVisible = displays.some(display => 
    this.isOverlapping(this.state, display.bounds)
  );
  // 如果上次记录的坐标在当前所有显示器中均不可见，回退到主屏幕中央
  if (!isVisible) {
    this.resetToPrimaryDisplay();
  }
}
```

窗口状态的持久化、防抖存储、跨屏容错均封装在独立模块内，不污染 `index.ts`。

---

## 5. Module Runner vs 传统 Electron 主进程

| 评估维度 | 传统模式 (散落式 / 面条代码) | Module Runner 架构 (本项目) |
| :--- | :--- | :--- |
| **代码量与集中度** | `index.ts` 经常达到 800~2000 行，成为“巨无霸”文件。 | 主入口装配仅 40 行，每个模块 20~100 行，结构清晰。 |
| **可维护性与协作** | 任何需求改动都要去碰全局主文件，极易产生 Git 冲突。 | 窗口修改动 `WindowManager`，托盘修改动 `TrayManager`，多人协作零冲突。 |
| **时序控制** | 散落在各个回调中，嵌套容易混乱，易发生竞态 Bug。 | `ModuleRunner` 串行执行链，异步时序完全确定、可预期。 |
| **安全基线保障** | 靠每个开发者的习惯在各个窗口手写安全配置，漏配率高。 | 抽象基类统一挂载全局 `web-contents-created`，强制统一安全基线。 |
| **特性插拔能力** | 增删功能需要小心翼翼地在多处注释事件和全局变量。 | 开关某个特性只需在链式调用中添加/删除 `.init(...)`。 |
| **可测试性** | 模块强耦合全局状态，基本无法脱离 Electron 进行单元测试。 | 纯逻辑通过接口与上下文注入解耦，支持独立 Mock 编写单测。 |

---

## 6. 手把手实战：5 分钟写一个新模块

假设我们要为应用增加一个**全局快捷键管理模块**（`GlobalShortcutModule`），按照 Module Runner 架构，开发极其直观：

### 第一步：编写模块类并实现 `AppModule`

新建 `packages/main/src/modules/GlobalShortcutModule.ts`：

```ts
import { globalShortcut } from 'electron';
import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { getLogManager } from './LogManager.js';

export class GlobalShortcutModule implements AppModule {
  async enable({ app }: ModuleContext): Promise<void> {
    // 1. 等待应用就绪
    await app.whenReady();

    const logger = getLogManager().mainLogger;

    // 2. 注册快捷键 (例如呼出主窗口)
    const registered = globalShortcut.register('CommandOrControl+Shift+X', () => {
      logger.info('[GlobalShortcut] Shortcut CommandOrControl+Shift+X triggered');
      // 执行业务逻辑，例如广播事件或激活窗口
    });

    if (!registered) {
      logger.warn('[GlobalShortcut] Failed to register global shortcut');
    }

    // 3. 应用退出时自动注销
    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
      logger.info('[GlobalShortcut] All shortcuts unregistered');
    });
  }
}

// 导出便捷工厂函数
export function createGlobalShortcutModule() {
  return new GlobalShortcutModule();
}
```

### 第二步：在装配流水线中引入

打开 `packages/main/src/index.ts`，只需一行：

```ts
import { createGlobalShortcutModule } from './modules/GlobalShortcutModule.js';

export async function initApp(initConfig: AppInitConfig) {
  const moduleRunner = createModuleRunner()
    .init(createLogModule())
    .init(createTRPCModule())
    .init(createWindowManagerModule({ initConfig, openDevTools: import.meta.env.DEV }))
    .init(createTrayModule())
    // 👉 优雅插入你的新模块
    .init(createGlobalShortcutModule())
    // ... 其余安全与系统模块 ...
    .init(terminateAppOnLastWindowClose());

  await moduleRunner;
}
```

无需修改任何现有模块的内部代码，无需担心对其他模块产生附带影响，这就是架构带来的生产力提升！

---

## 7. 总结

在小型 Demo 中，面向过程的脚本式写法或许见效最快；但对于**面向生产环境、需要长期迭代维护的桌面级应用**，代码的可读性、扩展性与安全规范才是决胜关键。

通过 **Module Runner 架构**：
- 我们把原本混乱的“事件回调迷宫”变成了条理分明的**装配流水线**；
- 将零散的代码封装成了符合统一契约的**标准乐高积木**；
- 将 Electron 的底层安全防御从“手动自觉”升维为“架构内建”。

如果你的团队也正饱受“上千行主进程难以维护”的困扰，不妨尝试这种模式，让代码重归优雅！
