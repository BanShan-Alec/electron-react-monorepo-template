# 项目演进与待办事项追踪 (Project Roadmap & TODO)

本文档用于追踪当前 Electron + Vite + React + tRPC 脚手架项目从“基础模板”向“成熟工业级脚手架”演进的完整路线图。

---

## 进度总览 (Progress Overview)

| 阶段 | 核心目标 | 状态 |
| :--- | :--- | :---: |
| **阶段 0：现代基础骨架与工程规范** | 安全沙箱加固、纯净子包、TypeScript 脚本、Biome、Husky、中文 Commit 规范、changelogen、配置收拢 | **100% 已完成** |
| **阶段 1：生产级核心基础设施** | 解决生产环境“无配置、无日志、无窗口记忆”的不可用状态 | **100% 已完成** |
| **阶段 2：桌面原生质感增强** | 形成真正的“桌面客户端”交互体验，而非套壳网页 | **100% 已完成** |
| **阶段 3：交付与质量保障** | 多平台打包快捷命令与代码签名指引 | **100% 已完成** |
| **阶段 4：架构完善与缺陷修复专项** | 修复生产打包暗坑/时序Bug (P0 已完成)、重构CI/CD、解耦前端巨石组件、接入React Query、增强原生能力 | **P0 100% 已完成 (进行中)** |

---

## 已完成里程碑 (Completed)

- [x] **架构级安全加固**
  - [x] 启用系统级强隔离沙箱 (`sandbox: true`)
  - [x] 彻底净化预加载脚本（删除无用的 Node 原生 Crypto 与 Process 暴露）
  - [x] 配置严格的 Content-Security-Policy (CSP)
  - [x] 解决窗口初始化白屏闪烁问题（优雅 `ready-to-show` 时序）
  - [x] 外部链接协议白名单安全校验（仅允许 `http:` / `https:`）
- [x] **工程目录与脚本现代化**
  - [x] 彻底清除脆弱冗余的 Playwright E2E 测试套件，精简百兆依赖
  - [x] 保持 3 个纯粹子包：`main`、`preload`、`renderer`
  - [x] 根目录所有构建与编排脚本统一收拢至 `scripts/` 并使用 TypeScript
- [x] **现代工程规范套件**
  - [x] 引入极速单二进制工具 **Biome**，彻底替换传统 ESLint + Prettier
  - [x] 接入 **Husky + lint-staged** 实现暂存区代码提交前自动格式化与校验
  - [x] 接入 **Commitlint** 并定制插件，强制要求 Commit 说明（Subject）必须包含**简体中文**
  - [x] 接入 **changelogen** 实现 SemVer 语义化版本自动推导与美观 CHANGELOG 生成
  - [x] 遵循现代工程实践，将所有配置文件统一收纳至 **.config/** 目录

---

## 阶段 1：生产级核心基础设施 (Phase 1: Core Infrastructure)

> **目标**：补齐桌面客户端在真实生产环境下必不可少的本地状态与排查机制。

### 1. 窗口状态持久化记忆 (Window State Keeper)
- [x] **痛点**：每次启动应用窗口都是默认宽高居中，用户自定义拖拽尺寸与位置在重启后丢失。
- [x] **实施方案**：
  - [x] 在 `packages/main/src/modules/WindowStateKeeper.ts` 中实现轻量级窗口状态记忆（监听窗口 `resize`、`move`、`maximize`）；
  - [x] 窗口关闭前自动保存 `{ x, y, width, height, isMaximized }` 至本地 JSON；
  - [x] 窗口创建时优先读取上次尺寸与坐标，防止多显示器断开时坐标飞出屏幕边界（结合 `screen.getAllDisplays` 做安全越界矫正与最小尺寸约束）。

### 2. 本地持久化配置存储 (Config & Preference Store)
- [x] **痛点**：主进程当前仅有内存变量 serverCounter = 0，缺乏本地偏好（如 Token、主题偏好、用户设置）的持久化方案。
- [x] **实施方案**：
  - [x] 提供开箱即用的类型安全本地配置存储 `packages/main/src/modules/ConfigStore.ts`，基于原子写入（atomic tmp rename）机制防断电损坏；
  - [x] 在 tRPC Router 中提供 `getAppConfig` / `updateAppConfig` / `resetAppConfig` 示范接口，端到端强类型读取与修改设置。

### 3. 生产级分级日志与异常排查体系 (Logging & Process-separated Rotation)
- [x] **痛点**：生产打包后主进程与渲染进程仅有 `console.log`，用户端出现白屏、异常闪退时开发者无从排查；若无轮转机制，长期运行可能撑爆用户磁盘；主/渲染进程日志混杂难以追踪。
- [x] **实施方案**：
  - [x] **接入分级日志库**：引入 `electron-log`，日志统一存储在操作系统标准用户数据目录（Windows `%APPDATA%/root/logs/`，macOS `~/Library/Logs/`）；
  - [x] **进程隔离记录**：
    - [x] **主进程独立日志**：输出至 `main.log`，记录应用生命周期、系统事件、原生模块状态；
    - [x] **渲染进程独立日志**：输出至 `renderer.log`（通过 tRPC 专有 `logMessage` procedure 安全沉淀），记录前端 UI 报错、路由调用异常与页面生命周期；
  - [x] **自动日志轮转 (Log Rotation)**：
    - [x] 单文件容量上限 5MB 自动分卷归档（生成 `main.old.log` / `renderer.old.log`）；
    - [x] 保留期限与备份上限（限制最多保留 7 天且最多 5 个历史归档），防止磁盘占用膨胀；
  - [x] **异常捕获与辅助诊断**：
    - [x] 捕获全局未捕获异常：`uncaughtException` 与 `unhandledRejection` 自动实时落盘并附加堆栈；
    - [x] 在 tRPC 中提供 `openLogFolder` 接口，在设置与控制台界面提供“一键打开日志目录”。

---

## 阶段 2：桌面原生质感增强 (Phase 2: Native Desktop Features)

> **目标**：摆脱套壳浏览器质感，赋予应用系统级交互与桌面原生能力。

### 4. 系统托盘与后台生命周期常驻 (System Tray Manager)
- [x] **痛点**：关闭窗口即退出整个程序，缺少现代桌面客户端标配的托盘交互。
- [x] **实施方案**：
  - [x] 在 `packages/main/src/modules/TrayManager.ts` 实现系统托盘；
  - [x] 配置系统托盘图标、托盘悬浮提示文案（Tooltip）与原生上下文右键菜单（显示主窗口、检查更新、退出应用）；
  - [x] 支持“点击关闭按钮最小化到系统托盘”的可选配置项（与 `ConfigStore` 的 `minimizeToTray` 配置双向打通，单击/双击托盘图标显隐主窗口）。

### 5. 原生文件对话框与系统能力范例 (Native Dialogs via tRPC)
- [x] **痛点**：渲染进程无法直接调用原生对话框，开发者缺乏标准 tRPC 实践范例。
- [x] **实施方案**：
  - [x] 在 tRPC Router 中补充实用的原生桌面接口：
    - [x] `openFileDialog`: 选择文件（支持过滤扩展名与多选）；
    - [x] `openDirectoryDialog`: 选择本地文件夹；
    - [x] `saveFileDialog`: 另存为文件对话框；
    - [x] `showItemInFolder`: 在系统的资源管理器/访达中定位并高亮文件；
  - [x] 在渲染端交互界面中完整集成原生对话框测试卡片。

---

## 阶段 3：交付与质量保障 (Phase 3: Delivery & Quality Assurance)

> **目标**：强化纯逻辑测试网，提供开箱即用的多平台发布快捷工具。

### 6. 纯逻辑单元测试 (已移除)
- [x] 根据需求精简项目，已完全移除 Vitest 依赖、配置文件及单测用例。

### 7. 跨平台打包快捷命令与签名指引 (Multi-platform Packaging & Signing)
- [x] **痛点**：打包命令单一，缺乏目标平台快捷编译及 Windows 签名/macOS 公证的环境变量指引。
- [x] **实施方案**：
  - [x] 在 `package.json` 中配置便捷打包命令：
    - [x] `npm run build:dir`: 仅构建解包绿色目录，免安装测试；
    - [x] `npm run build:win`: 打包 Windows 安装包 (NSIS / portable)；
    - [x] `npm run build:mac`: 打包 macOS 镜像 (DMG)；
    - [x] `npm run build:linux`: 打包 Linux 产物 (deb / AppImage)；
  - [x] 编写详细的桌面客户端代码签名（Code Signing）与 macOS 公证（Notarization）实战指南文档：[CODE_SIGNING_GUIDE.md](./CODE_SIGNING_GUIDE.md)。

---

## 阶段 4：架构完善与缺陷修复专项 (Phase 4: Architecture Refinement & Bug Fixes)

> **目标**：彻底消除生产打包暗坑与时序 Bug，重构 CI/CD，解耦前端巨石单文件并赋能现代 tRPC + React Query 模式，补齐桌面端双向通信与容灾兜底能力。

### P0：生产打包与运行时确定性缺陷 (Production Packaging & Runtime Fixes)

#### 1. 系统托盘图标生产打包丢失 Bug 修复
- **状态**：`[x] 已修复 (Fixed)`
- **涉及文件**：[`packages/main/src/modules/TrayManager.ts`](../packages/main/src/modules/TrayManager.ts)、[`.config/electron-builder.ts`](../.config/electron-builder.ts)
- **痛点**：`TrayManager.ts` 读取 `buildResources/icon.png`，但 `electron-builder` 默认打包规则中 `buildResources` 不会被打包进 `app.asar`。生产包打包运行后，托盘图标变为空白透明或报错。
- **修复方案**：
  - [x] 将运行时托盘图标移入静态资源目录或在 `electron-builder` 中配置 `extraResources` 显式导出；
  - [x] 针对 Windows (.ico / 16x16 png) 与 macOS (Retina `Template.png`) 托盘图标做自适应加载。

#### 2. WindowStateKeeper 冷启动 screen 未就绪时序 Bug 修复
- **状态**：`[x] 已修复 (Fixed)`
- **涉及文件**：[`packages/main/src/modules/WindowStateKeeper.ts`](../packages/main/src/modules/WindowStateKeeper.ts)、[`packages/main/src/modules/WindowManager.ts`](../packages/main/src/modules/WindowManager.ts)
- **痛点**：`WindowManager` 构造时同步初始化 `WindowStateKeeper` 并调用 `screen.getAllDisplays()`。Electron 强制要求 `screen` 必须在 `app.whenReady()` 后调用，冷启动时触发内部抛错并被 catch 吞掉，导致每次冷启动窗口状态记忆永远回退至默认值。
- **修复方案**：
  - [x] 将 `WindowStateKeeper` 的初始多显示器有效性校验推迟至 `app.whenReady()` 事件触发后执行。

#### 3. GitHub Actions CI/CD 工作流重构（适配 pnpm 与现代化工程）
- **状态**：`[x] 已修复 (Fixed)`
- **涉及文件**：[`.github/actions/init-template-with-renderer/action.yml`](../.github/actions/init-template-with-renderer/action.yml)、[`.github/workflows/compile-and-test.yml`](../.github/workflows/compile-and-test.yml)
- **痛点**：当前 CI 仍在使用旧版 `npm ci`、`npm run create-renderer` 和 `@app/integrate-renderer`。项目全量迁移至 `pnpm` 后，CI 触发 100% 报错中断。
- **修复方案**：
  - [x] 使用 `pnpm/action-setup` 统一管理 pnpm 依赖安装（`pnpm install --frozen-lockfile`）；
  - [x] 彻底清理已删除的旧模板脚本调用，跑通跨平台（Windows / Linux / macOS）构建流水线。

#### 4. 修复 `@app/main` 的 Package 导出声明与构建产物脱节
- **状态**：`[x] 已修复 (Fixed)`
- **涉及文件**：[`packages/main/package.json`](../packages/main/package.json)、[`packages/main/vite.config.ts`](../packages/main/vite.config.ts)
- **痛点**：`package.json` 导出了 `"./router": "./dist/router/index.js"`，但 Vite 构建配置中仅有单一入口 `src/index.ts`，打包产物根本不存在 `dist/router/index.js`。
- **修复方案**：
  - [x] 将 `@app/main` 的 `./router` 导出规范化为纯类型导出（仅保留 `"types": "./src/router/index.ts"` 并移除虚假的 `"default"` 运行时产物声明），Vite 保持单一入口极速构建，既保障前端 `import type` 完整提示，又在编译期杜绝渲染端误引主进程代码。

#### 5. 生产环境外链白名单判定失常 Bug 修复 (Security & External URLs)
- **状态**：`[x] 已修复 (Fixed)`
- **涉及文件**：[`packages/main/src/index.ts`](../packages/main/src/index.ts)、[`packages/main/src/modules/ExternalUrls.ts`](../packages/main/src/modules/ExternalUrls.ts)
- **痛点**：在 `index.ts` 中外链白名单判定写为 `initConfig.renderer instanceof URL ? [...] : []`。在打包后的生产环境中，`renderer` 传入的是文件路径对象而非 `URL` 实例，导致生产环境白名单被置为空 `Set([])`，用户在生产包内点击任何合规外链（GitHub/官网/帮助文档）被 100% 误杀拦截打不开；且 `new URL(url)` 未做异常捕获防崩溃。
- **修复方案**：
  - [x] 解耦生产/开发的外链白名单逻辑，无论开发还是生产模式均注入标准外链白名单；
  - [x] 在 `ExternalUrls.ts` 中添加 URL 解析容错，防止非法 URL 导致主进程未捕获异常退出。

> **已评估并忽略项 (Ignored / Won't Fix)**：
> - **Vite 8 `configLoader: 'native'` 构建提示**：经实测，该 Warning 仅为 Vite 8 在 Node 22 下对配置自身加载器的实验性过渡提醒，对开发与生产运行无任何负面影响，盲目添加 `"type": "module"` 反而会破坏 CJS 产物运行。决定不作代码侵入，保持现状并忽略。

---

### P1：渲染端架构重构与现代 tRPC 体验 (Frontend Architecture & tRPC DX)

#### 5. 接入 `@tanstack/react-query` 消除样板代码
- **状态**：`[ ] 待修复 (Pending)`
- **参考规范**：`specs/frontend/react-pitfalls.md`（加载态与骨架屏闪烁防御、Hook 依赖稳定性）、`specs/frontend/ipc-electron.md`（数据刷新订阅与轻量消费模式）
- **涉及文件**：[`packages/renderer/src/trpc.ts`](../packages/renderer/src/trpc.ts)、[`packages/renderer/package.json`](../packages/renderer/package.json)、[`packages/renderer/src/main.tsx`](../packages/renderer/src/main.tsx)
- **痛点**：裸用 `@trpc/client` 导致所有组件充斥着手写 Promise、`useState`、`useEffect`、`try...catch` 等样板代码，失去缓存、防抖、自动重试与失效更新能力，且容易在后台静默刷新时引发骨架屏突兀闪烁。
- **修复方案与落地细节**：
  - [ ] 在 `@app/renderer` 引入 `@tanstack/react-query` 与 `@trpc/react-query`；
  - [ ] 配置标准 `QueryClient`（配置 `staleTime: 5000`、`gcTime: 300000`、`retry: 1`、`refetchOnWindowFocus: false`）；
  - [ ] 在 `main.tsx` 包装 `<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider>`；
  - [ ] 在组件中全面采用 `trpc.xxx.useQuery()` 与 `trpc.xxx.useMutation({ onSuccess: () => utils.xxx.invalidate() })` 范式，严格区分首次加载态（`isLoading`）与静默后台刷新态（`isRefetching`），避免 UI 闪烁。

#### 6. 拆解 739 行巨石单文件 `App.tsx` 与 Tailwind CSS v3 垂直分片重构
- **状态**：`[x] 已完成 (Fixed)`
- **参考规范**：`specs/frontend/directory-structure.md`（按 Feature 垂直分片与集中式 CSS 规范）、`specs/frontend/components.md`（语义化 HTML、防抖动滚动条、设计 Token）
- **涉及文件**：[`packages/renderer/src/App.tsx`](../packages/renderer/src/App.tsx)、[`packages/renderer/src/styles/`](../packages/renderer/src/styles/)、[`packages/renderer/src/components/`](../packages/renderer/src/components/)、[`packages/renderer/src/features/`](../packages/renderer/src/features/)
- **痛点**：脚手架原本将所有功能硬编码在 739 行巨石 `App.tsx` 中，且样式散落混杂；现全面按 Vertical Slice 与 Tailwind CSS v3 体系重构。
- **实施成果**：
  - [x] **Tailwind CSS v3 工程化接入**：配置 `tailwindcss@^3.4.19`、`postcss`、`autoprefixer`，建立 `styles/tokens.css`、`styles/base.css`、`styles/index.css` 集中样式层与设计 Token（支持 `scrollbar-gutter: stable`、`platform-mac`、`drag-region` 等）；
  - [x] **通用原子组件库 (`src/components/ui/`)**：封装 `Button`、`Card`、`Input`、`Badge` 等符合语义与无障碍标准的组件；
  - [x] **布局组件 (`src/components/layout/`)**：抽象 `AppHeader` 顶部导航与状态徽章；
  - [x] **业务特性垂直分片 (`src/features/{feature}/`)**：
    - `features/system-info/`：系统环境与网络延迟检测；
    - `features/counter/`：计数器模块与 Hook；
    - `features/calculator/`：安全计算器与除零容错；
    - `features/settings/`：持久化配置面板与原子写入校验；
    - `features/native-dialogs/`：系统文件/目录/另存为对话框；
    - `features/diagnostics/`：分级日志沉淀与开发者工具控制；
    - `features/architecture/`：技术架构图与规范速览；
  - [x] **瘦身 `App.tsx`**：主容器收敛至 ~100 行，UI 表现与状态 Hook 彻底解耦，每个 Feature 模块均符合独立内聚与单文件不超过 300 行规范。

#### 8. 根目录 `README.md` 与脚手架实际技术栈严重脱节重构 (Documentation & DX)
- **状态**：`[ ] 待修复 (Pending)`
- **参考规范**：`specs/docs/新人入职资料.md`、`specs/README.md`（现代开源工程规范体系）
- **涉及文件**：[`README.md`](../README.md)
- **痛点**：根目录 README 仍严重残留旧上游模板英文文档（提及早已被删除的 `@app/integrate-renderer`、要求运行不存在的 `npm run init`、声称未包含渲染端）。对当前项目的 React 19、tRPC、Biome、Husky、Commitlint、ConfigStore、LogManager、多平台打包等核心基础设施毫无介绍，导致新人上手 100% 执行失败。
- **修复方案与落地细节**：
  - [ ] 彻底重写为中文官方说明文档，提供标准的 5 分钟快速上手指南；
  - [ ] 详细阐述 Monorepo 拓扑结构、核心技术选型、可用脚本清单（`dev`, `build`, `build:win`, `build:mac`, `build:linux`, `lint`, `typecheck`, `release`）；
  - [ ] 提供完整的 tRPC 端到端新增接口教程、安全沙箱最佳实践、分级日志查看与打包签名指南。

---

### P2：桌面原生体验与双向能力闭环 (Native Desktop & Bi-directional Communication)

#### 9. 实现主进程主动推送（Server-to-Client Push / Subscription）通道
- **状态**：`[ ] 待修复 (Pending)`
- **参考规范**：`specs/frontend/ipc-electron.md`（数据刷新订阅模式与取消监听闭环）、`specs/big-question/ipc-handler-registration.md`
- **涉及文件**：[`packages/main/src/modules/TRPCModule.ts`](../packages/main/src/modules/TRPCModule.ts)、[`packages/preload/src/exposed.ts`](../packages/preload/src/exposed.ts)、[`packages/renderer/src/hooks/`](../packages/renderer/src/hooks/)
- **痛点**：目前通信仅支持渲染端主动拉取，主进程无法主动向下游推送系统事件（如自动更新下载进度、系统休眠/唤醒、网络断开等）。
- **修复方案与落地细节**：
  - [ ] 在主进程提供标准 Event Broadcaster，利用 `BrowserWindow.getAllWindows()[].webContents.send(channel, payload)` 进行事件广播；
  - [ ] 预加载脚本（Preload）中暴露订阅函数，并**强制返回配对的 `unsubscribe()` 闭包**，严防内存泄漏；
  - [ ] 联动 `AutoUpdater` 模块，将下载进度百分比与状态变更实时推送到前端进度条；
  - [ ] 联动系统休眠（`powerMonitor.on('suspend'/'resume')`）与网络状态变更通知。

#### 10. 配置项与原生系统能力真实闭环 (Config to System Integration)
- **状态**：`[ ] 待修复 (Pending)`
- **参考规范**：`specs/backend/environment.md`、`specs/backend/api-module.md`
- **涉及文件**：[`packages/main/src/modules/ConfigStore.ts`](../packages/main/src/modules/ConfigStore.ts)、[`packages/main/src/index.ts`](../packages/main/src/index.ts)、[`packages/renderer/src/App.tsx`](../packages/renderer/src/App.tsx)
- **痛点**：`theme`、`autoCheckUpdate` 等配置存盘后未在主进程联动生效，沦为“死配置”。
- **修复方案与落地细节**：
  - [ ] 联动 Electron `nativeTheme.themeSource`：配置写入时自动同步 `system` / `dark` / `light`，并向前端广播主题变化，使 HTML 根节点同步切换 `dark` class；
  - [ ] `autoCheckUpdate` 联动实际的后台更新轮询定时器（`setInterval` / `clearInterval` 动态注销与启动）；
  - [ ] `minimizeToTray` 与窗口关闭拦截器进行双向状态绑定。

#### 11. 现代沉浸式无边框窗口 (Frameless TitleBar) 范例
- **状态**：`[ ] 待修复 (Pending)`
- **参考规范**：`specs/frontend/components.md`（桌面端无边框窗口标题栏与防穿透）、`specs/frontend/ipc-electron.md`（macOS 红绿灯与拖拽区域联动）
- **涉及文件**：[`packages/main/src/modules/WindowManager.ts`](../packages/main/src/modules/WindowManager.ts)、[`packages/renderer/src/components/layout/TitleBar.tsx`](../packages/renderer/src/components/layout/)
- **痛点**：原生标题栏风格老旧，缺乏现代桌面应用主流的沉浸式无边框窗口实践。
- **修复方案与落地细节**：
  - [ ] 主进程 `WindowManager` 窗口创建参数适配：
    - macOS 使用 `titleBarStyle: 'hiddenInset'`，并校准 `trafficLightPosition: { x: 12, y: 12 }`；
    - Windows / Linux 可选使用 `titleBarStyle: 'hidden'` 或 `frame: false`；
  - [ ] 渲染端注入 `platform-mac` class，macOS 下为标题栏左侧自适应预留 80px 红绿灯边距；
  - [ ] 标题栏外层容器声明 `-webkit-app-region: drag`，所有交互按钮（最小化、最大化/还原、关闭、主题切换）显式声明 `-webkit-app-region: no-drag`，彻底杜绝点击被窗口拖拽拦截；
  - [ ] 在 tRPC 中提供 `minimizeWindow`、`maximizeWindow`、`closeWindow`、`isMaximized` 接口。

#### 12. 原生应用菜单 (Application Menu) 与全局快捷键抽象
- **状态**：`[ ] 待修复 (Pending)`
- **参考规范**：`specs/frontend/ipc-electron.md`（菜单快捷键作为权威源、全局快捷键注册与注销生命周期）
- **涉及文件**：[`packages/main/src/modules/MenuManager.ts`](../packages/main/src/modules/)、[`packages/main/src/modules/ShortcutManager.ts`](../packages/main/src/modules/)
- **痛点**：缺少原生顶部菜单（macOS 标配）与全局快捷键（如一键呼出窗口、截图等）的基础设施抽象。
- **修复方案与落地细节**：
  - [ ] 封装 `MenuManager.ts`：以 `Menu.setApplicationMenu(Menu.buildFromTemplate(...))` 作为系统菜单与快捷键的权威基准（内置标准 File、Edit、View、Window、Help 菜单项，绑定 `CmdOrCtrl+,` 呼出设置、`CmdOrCtrl+W` 关窗等）；
  - [ ] 封装 `ShortcutManager.ts`：统一调度 `globalShortcut`，在 `app.on('before-quit')` 时执行 `globalShortcut.unregisterAll()`，避免快捷键泄露。

#### 13. macOS 平台窗口关闭强退与激活生命周期 Bug (macOS HIG & Lifecycle)
- **状态**：`[ ] 待修复 (Pending)`
- **参考规范**：`specs/backend/macos-permissions.md`、`specs/frontend/ipc-electron.md`（macOS 交互规范）
- **涉及文件**：[`packages/main/src/modules/ApplicationTerminatorOnLastWindowClose.ts`](../packages/main/src/modules/ApplicationTerminatorOnLastWindowClose.ts)、[`packages/main/src/modules/WindowManager.ts`](../packages/main/src/modules/WindowManager.ts)
- **痛点**：根据“维度 8：跨平台兼容性”审查，`ApplicationTerminatorOnLastWindowClose` 在 `window-all-closed` 事件中无条件执行 `app.quit()`。违背了 macOS 平台“关闭全部窗口后应用仍保留在 Dock”的标准交互准则，并导致 `WindowManager.ts` 中针对 macOS 的 `app.on('activate')` 唤醒窗口逻辑彻底沦为永远无法触发的死代码。
- **修复方案与落地细节**：
  - [ ] 增加操作系统判断 `if (process.platform !== 'darwin') app.quit()`；
  - [ ] 确保 macOS 下点击 Dock 图标触发 `app.on('activate')` 时能正常调起并恢复主窗口。

#### 14. 国际化 (i18n) 伪多语言与 HTML 语义脱节 (Accessibility & i18n)
- **状态**：`[ ] 待修复 (Pending)`
- **参考规范**：`specs/frontend/components.md`（语义化与 a11y 无障碍规范）
- **涉及文件**：[`packages/renderer/index.html`](../packages/renderer/index.html)、[`packages/renderer/src/App.tsx`](../packages/renderer/src/App.tsx)、[`packages/shared/src/index.ts`](../packages/shared/src/index.ts)、`packages/renderer/src/locales/`
- **痛点**：根据“维度 7：无障碍与国际化”审查，`index.html` 硬编码 `<html lang="en">`，但 UI 界面硬编码全中文文本；配置表虽有 `language` 字段，但前端无任何多语言解析方案，缺少面向多语种桌面端的基本扩展能力。
- **修复方案与落地细节**：
  - [ ] 接入轻量国际化方案，建立 `src/locales/`（`zh-CN.json`, `en-US.json`）语言包管理机制；
  - [ ] 联动 `ConfigStore.language`，切换语言时同步更新 HTML 根节点的 `lang` 属性及界面文字。

---

### P3：容灾防御与质量保障 (Reliability & Quality Assurance)

#### 15. 渲染端接入 React ErrorBoundary 容灾兜底
- **状态**：`[ ] 待修复 (Pending)`
- **参考规范**：`specs/backend/error-handling.md`（分级错误处理与防吞噬）、`specs/frontend/electron-browser-api-restrictions.md`（防崩溃兜底）
- **涉及文件**：[`packages/renderer/src/components/ErrorBoundary.tsx`](../packages/renderer/src/components/)、[`packages/renderer/src/main.tsx`](../packages/renderer/src/main.tsx)
- **痛点**：渲染端发生运行时异常时直接全白屏，缺乏友好的错误排查提示与一键重新加载机制。
- **修复方案与落地细节**：
  - [ ] 实现类组件 `ErrorBoundary.tsx`，捕获 `componentDidCatch` 异常；
  - [ ] 提供美观的崩溃兜底视图（呈现错误原因、堆栈信息格式化高亮、一键复制错误信息按钮、重载应用按钮）；
  - [ ] 自动调用 tRPC `logMessage` 将前端未捕获异常及其 Component Stack 实时落盘至 `renderer.log`。

#### 16. 接入渲染进程假死与崩溃监听 (Crash & Freeze Guard)
- **状态**：`[ ] 待修复 (Pending)`
- **参考规范**：`specs/backend/error-handling.md`（模式 4：系统崩溃捕获与不可恢复异常隔离）、`specs/backend/logging.md`
- **涉及文件**：[`packages/main/src/modules/WindowManager.ts`](../packages/main/src/modules/WindowManager.ts)
- **痛点**：渲染进程意外退出（OOM/底层崩溃）或主线程假死未响应时，无任何捕获与感知。
- **修复方案与落地细节**：
  - [ ] 在 `BrowserWindow.webContents` 上监听 `render-process-gone` 事件，捕获 `crashed`、`oom`、`killed` 等异常退出状态与 exitCode；
  - [ ] 监听 `unresponsive` 与 `responsive` 事件，感知主线程卡死状态；
  - [ ] 发生崩溃时自动将核心堆栈输出至 `main.log`，并通过原生 Dialog 提示用户一键重新加载页面。

#### 17. 补齐核心纯逻辑轻量级单元测试 (Vitest)
- **状态**：`[ ] 待修复 (Pending)`
- **参考规范**：`specs/shared/code-quality.md`（纯逻辑单测与边界守护体系）
- **涉及文件**：[`vitest.config.ts`](../vitest.config.ts)、`packages/main/tests/`、`packages/shared/tests/`
- **痛点**：单测被全量拔除，像 `WindowStateKeeper` 边界计算、`ConfigStore` 原子防损、tRPC 输入校验没有任何测试覆盖。
- **修复方案与落地细节**：
  - [ ] 配置轻量极速的 Vitest 单测套件（纯 TS/Node 逻辑测试，不引入繁重的无头浏览器）；
  - [ ] 针对 `validateWindowState` 编写多显示器越界修正测试（主副屏断开、负坐标、最小尺寸等边界）；
  - [ ] 针对 `ConfigStore` 编写并发写入与异常容错测试；
  - [ ] 针对 `ExternalUrls` 编写协议白名单与非法 URL 拦截测试。

#### 18. 优化 Windows 下开发模式子进程生命周期管理
- **状态**：`[ ] 待修复 (Pending)`
- **参考规范**：`specs/big-question/native-module-packaging.md`、`specs/guides/engineering-checklist.md`
- **涉及文件**：[`scripts/dev.ts`](../scripts/dev.ts)
- **痛点**：`electronApp.kill('SIGINT')` 在 Windows 下容易造成进程残留和端口锁死。
- **修复方案与落地细节**：
  - [ ] 引入 `tree-kill` 跨平台进程树清理方案；
  - [ ] 在主进程热重载或开发脚本退出（`SIGINT`/`SIGTERM`）时，递归杀掉 Electron 主进程及其所有 Chromium 渲染/GPU 衍生子进程树，彻底防止 Windows 下进程残留与文件端口锁死。

#### 19. 封装全局统一交互反馈机制 (Toast & Alert Feedback)
- **状态**：`[ ] 待修复 (Pending)`
- **参考规范**：`specs/frontend/components.md`（吐司通知设计准则与毛玻璃质感）、`specs/frontend/electron-browser-api-restrictions.md`（严禁调用原生 `alert()` / `confirm()` / `prompt()` 导致崩溃）
- **涉及文件**：[`packages/renderer/src/components/ui/Toast.tsx`](../packages/renderer/src/components/ui/)、[`packages/renderer/src/hooks/useToast.ts`](../packages/renderer/src/hooks/)
- **痛点**：根据“维度 6：纯前端 UI 交互”审查，当前在 tRPC 发生异常（如除以零、后端错误）时，仅在组件局部显示红字或控制台输出，缺乏像桌面应用通用的全局 Toast / Notification 浮层反馈组件；且容易误用浏览器原生 `alert()` 导致 Electron 崩溃。
- **修复方案与落地细节**：
  - [ ] 封装轻量级毛玻璃质感（Glassmorphism）Toast 容器组件与 `useToast` Hook；
  - [ ] 支持 `toast.success(msg)`、`toast.error(msg)`、`toast.info(msg)`，支持可配置持续时间（默认 3 秒）与纵向优雅堆叠；
  - [ ] 统一承接 tRPC 异步调用的成功、告警与错误弹窗反馈。