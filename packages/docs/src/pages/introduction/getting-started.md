---

title: 快速上手（Getting Started）
description: 对齐 Node 24 与 pnpm 12 环境基线，通过三步命令启动开发编排、生产预览与日常校验。
---

# 快速上手（Getting Started）

> **TL;DR**：通过 `nvm use` 与 `corepack enable` 对齐版本基线后，执行 `pnpm install`、`pnpm dev` 与 `pnpm preview` 即可在本地跑通开发态与生产预览态。

**边界声明**：本页负责本地宿主机环境准备、首次启动流程与常用入口命令指引；不负责开发编排内部机制（见 [开发编排](/dx/dev-orchestration)）、打包配置细节（见 [应用打包](/delivery/packaging)）或全量 CI 门禁说明（见 [CI 并行门禁](/delivery/ci-gates)）。

## 环境基线与激活命令

启动前请确认本地宿主环境满足 [package.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/package.json) 约束，并执行前置激活命令：

- **Node.js `>= 24.0.0`**：根目录 `.nvmrc` 钉死主版本 `24`，可执行 `nvm use` 自动切换并用 `node -v` 核对。
- **pnpm `^12.0.0`**：根 `packageManager` 指定 `pnpm@12.15.0`，可执行 `corepack enable` 激活匹配版本并用 `pnpm -v` 核对。
- **C++ 编译工具链**（仅在重编译 `usb` 等原生模块时需要）：Windows 需安装 Visual Studio Build Tools（「使用 C++ 的桌面开发」工作负荷），macOS 需安装 Xcode Command Line Tools；常规业务开发无需配置。

## 首次启动三步走

::::steps

### 1. 安装依赖

```bash
pnpm install
```

- **内部行为**：根 `.npmrc` 预设淘宝镜像源，`postinstall` 脚本通过 `ELECTRON_MIRROR` 下载匹配当前平台的 Electron 预编译二进制。
- **成功判据**：命令退出码为 `0`，且 `node_modules` 下已就位 Electron 二进制（未报错跳过下载）。
- **常见失败**：网络代理拦截二进制下载或 `pnpm` 版本低于 12；可核对 `pnpm -v` 与网络连通性后重试，或手动执行 `pnpm exec install-electron`。

### 2. 启动开发态编排

```bash
pnpm dev
```

- **内部行为**：按 [scripts/dev.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/dev.ts) 先后执行单实例锁探测与端口排查（默认占用 Vite `5173`、CDP `9222`），再启动渲染层 Dev Server 并并行开启 Preload 与 Main 的监听增量构建。
- **成功判据**：终端输出 `[dev] mode=development` 与渲染层地址，且自动弹出主应用窗口，修改主进程或渲染层代码可自动热更或重启。
- **常见失败**：若端口被占或旧实例/托盘常驻持有单实例锁，终端会交互询问是否终止旧进程树（`y/N`）；在非交互终端（Non-TTY）下会直接抛出错误退出，需手动退出托盘实例后重试。

### 3. 构建并预览生产行为

```bash
pnpm preview
```

- **内部行为**：仅构建 `@app/main`、`@app/preload`、`@app/renderer` 三包产物（跳过 `@app/docs`），随后拉起 Electron 窗口加载本地 `dist` 静态资源并启用生产级 CSP 策略。若已有三包产物，可运行 `pnpm preview -- --skip-build` 跳过编译。
- **成功判据**：三包构建均通过后弹出应用窗口，控制台输出 `skip renderer dev server, loading dist artifacts`。
- **常见失败**：使用 `--skip-build` 时若缺少主进程或渲染层入口产物，脚本会列出缺失路径并退出，重新运行无参数的 `pnpm preview` 即可补齐。

::::

## 常用命令入口

下表收敛本地开发最常用的脚本入口，各命令的内部门禁细节由对应维度的专属页面维护：

| 命令                           | 用途与覆盖范围                                            | 详细机制页                                        |
| :----------------------------- | :-------------------------------------------------------- | :------------------------------------------------ |
| `pnpm dev` / `preview`         | 开发态编排（单实例与端口预检） / 三包生产预览             | [开发编排](/dx/dev-orchestration)                 |
| `pnpm typecheck`               | 全仓 Monorepo 跨包类型检查（`tsc -b --noEmit`）           | [编译配置继承](/engineering/tsconfig-inheritance) |
| `pnpm lint` / `lint:fix`       | Biome 架构红线扫描与代码格式化（含 Markdown）             | [代码规范与风格](/engineering/code-style)         |
| `pnpm test`                    | 运行 Main、Preload、Renderer、Shared 与 `build/` 单元测试 | [单元测试（Vitest）](/testing/unit-tests)         |
| `pnpm verify:prebuild`         | 打包前置门禁：校验根 `name`、根依赖白名单与渲染层样式令牌 | [依赖管理](/engineering/dependency-management)    |
| `pnpm test:e2e:build`          | 全量构建后通过 Playwright 真实窗口运行端到端断言          | [端到端测试（Playwright）](/testing/e2e-electron) |
| `pnpm build:win\|mac\|linux`   | 构建对应桌面平台安装包（NSIS / DMG / DEB）                | [应用打包](/delivery/packaging)                   |
| `pnpm docs:dev` / `docs:build` | 本地 `5174` 端口预览文档站 / 执行静态构建与死链检测       | —                                                 |
