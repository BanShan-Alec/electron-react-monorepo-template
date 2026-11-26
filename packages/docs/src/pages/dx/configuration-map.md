---

title: 配置项归属（Configuration-map）
description: 单一所有者速查表：明确应用身份、构建脚手架、环境变量、开发编排、共享常量与用户偏好的归属、生效时机与边界。
---

# 配置项归属（Configuration-map）

> **TL;DR**：每个配置项只允许一个所有者（Single Owner）——应用身份在根 `package.json`、构建入口在 `scripts/build.ts` 与 `build/`、环境差异在根 `.env`、开发编排在 `scripts/dev.ts`、共享常量在 `packages/shared`、用户偏好在 `userData/config.json`。

## 1. 边界与六层配置归属法则

本页负责回答「某个配置项该改哪份文件、何时生效、联动哪些侧面」，是全仓配置修改的索引清单。本页不展开各层的内部实现细节：环境变量加密透传见 [环境变量管理](/engineering/env-vars)，开发编排与端口开关见 [开发编排](/dx/dev-orchestration) 与 [远程调试端口](/dx/debug-port)，配置持久化与窗口恢复机制见 [配置持久化](/main/config-persistence) 与 [窗口位置与尺寸](/ui/window-state)。

在新增配置前，先按三条原则判定归属：
- **随代码仓库走的产品身份与安全阈值**（如 `productName`、外链域名白名单、窗口几何常数）写入根 `package.json` 或 `packages/shared`，禁止下放 `.env` 造成环境漂移。
- **随部署或构建环境变化的开关与地址**（如 `API_BASE_URL`、`MAX_ASAR_SIZE_MB`、`SENTRY_DSN`）写入根 `.env`，并通过 [环境变量管理](/engineering/env-vars) 白名单透传。
- **用户在桌面端运行时可自由修改的偏好**（如主题、语言、托盘驻留）统一归入 `userData/config.json`，并经过 Zod 契约校验（见 [类型安全的 IPC 契约](/security/ipc-contract) 与 [托盘常驻与单实例](/main/tray-single-instance)）。

| 配置层级                | 存储载体                       | 包含范围                                            | 生效机制与时机                  |
| :---------------------- | :----------------------------- | :-------------------------------------------------- | :------------------------------ |
| **应用身份 / OTA 坐标** | 根 `package.json`              | `name`、`productName`、`appId`、`repository`        | 构建期与物理打包期注入          |
| **构建入口与配置**      | `scripts/build.ts` 与 `build/` | 打包调度、`electron-builder.ts`、NSIS、`lib/`       | `pnpm build:*` 打包期执行       |
| **环境差异变量**        | 根 `.env` / Shell              | `API_BASE_URL`、发布通道、`MAX_ASAR_SIZE_MB`、`DSN` | 构建期内联快照 + 运行时参数覆盖 |
| **开发态编排**          | `scripts/dev.ts`               | Vite 端口、CDP 远程调试、主进程断点端口             | `pnpm dev` / `pnpm preview` 时  |
| **跨端契约常量**        | `packages/shared`              | 窗口几何比例、IPC 通道名、外链安全白名单            | 源码编译进产物（需重启/重构建） |
| **用户偏好设置**        | `userData/config.json`         | 主题模式、语言 Locale、托盘最小化、关闭确认         | 运行时读写（经 IPC 瞬时生效）   |

## 2. 常见改动速查表（Cheat-Sheet）

下表按「改动目标 → 唯一真源 → 生效方式 → 风险与联动」检索；其中构建入口由 [scripts/build.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/build.ts) 调度，[build/electron-builder.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/build/electron-builder.ts) 与 `build/lib/` 仅承载打包配置与跨脚本共享底座（如身份解析 `app-identity.ts`、路径推导 `repo-paths.ts`、环境加载 `env.ts`）。

| 想改什么               | 修改文件与字段                                                                                  | 生效命令 / 时机  | 潜在影响与避坑要点                                                                                                                                                                                                                                |
| :--------------------- | :---------------------------------------------------------------------------------------------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **应用展示名**         | 根 `package.json` ➔ `productName`                                                               | 重新构建打包     | **高危**：会改变操作系统 `userData` 目录路径，旧用户数据与日志不会自动迁移                                                                                                                                                                        |
| **应用包名 / 资产名**  | 根 `package.json` ➔ `name`                                                                      | 重新构建打包     | 必须为小写字母、数字、中划线或下划线，`pnpm verify:prebuild` 静态门禁强制拦截                                                                                                                                                                     |
| **系统应用 ID**        | 根 `package.json` ➔ `appId`                                                                     | 重新打包         | 影响 Windows 桌面通知 AUMID 与 macOS Bundle ID，发布后切勿随意变更                                                                                                                                                                                |
| **前端品牌主色**       | `packages/renderer/src/styles/design-tokens.ts`                                                 | Vite 实时热更    | Ant Design 主题算法与 CSS 变量作用域自动联动（详见 [设计规范与令牌](/ui/design-tokens)）                                                                                                                                                          |
| **应用元信息单一真源** | 根 `package.json` ➔ `productName` / `author.name` / `author.url` / `license` / `repository.url` | 重新构建打包     | 由 `build/lib/app-identity.ts` 注入为 `__APP_INFO__`（renderer 与 vitest 共用），`shared/constants/app-info.ts` 仅派生子路径；缺字段构建立即报错                                                                                                  |
| **API 请求基础地址**   | 根 `.env` ➔ `API_BASE_URL`                                                                      | 重启开发或重构建 | 运行期可通过 `APP_API_BASE_URL` 环境变量免打包覆盖（详见 [环境变量管理](/engineering/env-vars)）                                                                                                                                                  |
| **开发态渲染端口**     | `scripts/dev.ts` ➔ `config.rendererPort`                                                        | 重启 `pnpm dev`  | 端口被占时预检交互式提示释放，并通过 `VITE_DEV_SERVER_URL` 告知主进程                                                                                                                                                                             |
| **主进程源码级断点**   | `scripts/dev.ts` ➔ `config.mainInspectPort`                                                     | 取消注释并重启   | 启用后传入 `--inspect-brk=9229`，阻塞等待 IDE 调试器附加（见 [远程调试端口](/dx/debug-port)）                                                                                                                                                     |
| **渲染层 CDP 端口**    | `scripts/dev.ts` ➔ `config.rendererCdpPort`                                                     | 注释即关闭并重启 | 注释后停止注入 `--remote-debugging-port` 与启动日志，[启动预检](/dx/startup-preflight) 不再探测该端口                                                                                                                                             |
| **打包体积限制阈值**   | 根 `.env` ➔ `MAX_ASAR_SIZE_MB`                                                                  | 下次执行打包校验 | 由 `scripts/verify-postbuild.ts` 校验 `app.asar` 体积（默认 10MB，见 [分包与体积门禁](/security/bundle-budget)）                                                                                                                                  |
| **Sentry 异常上报源**  | 根 `.env` ➔ `SENTRY_DSN`                                                                        | 打包构建时生效   | 生产环境上传 SourceMap 需在 CI Secrets 配置 `SENTRY_AUTH_TOKEN`（见 [崩溃上报](/main/crash-reporting)）                                                                                                                                           |
| **外链打开域名白名单** | `packages/shared/src/constants/security.ts`                                                     | 重新构建主进程   | 拦截非白名单外链通过系统浏览器打开，防范桌面端开放重定向风险                                                                                                                                                                                      |
| **应用安装包图标**     | `build/resources/icon.{ico,icns,png}`                                                           | 重新打包生效     | 打包图标与运行期托盘资源的统一来源（打包细节见 [应用打包](/delivery/packaging)）                                                                                                                                                                  |
| **默认窗口几何尺寸**   | `packages/shared/src/constants/window-geometry.ts`                                              | 重新构建主进程   | `MAX_WORK_AREA_WIDTH_RATIO`（95% 宽）与 `MAX_WORK_AREA_RATIO`（85% 高）同时约束主窗口（`DEFAULT_WINDOW_*` 1024×700）与更新窗口（`UPDATER_WINDOW_*` 700×460）；续启位置尺寸由 Chromium `Local State` 恢复（见 [窗口位置与尺寸](/ui/window-state)） |
| **系统托盘图标与行为** | `packages/main/src/modules/tray.module.ts`                                                      | 重启主进程生效   | Windows 直传多 DPI `.ico`；macOS 刻意保留全彩品牌图标而非 Template 图，防止透明通道压成实心方块                                                                                                                                                   |

## 3. 校验判据与避坑清单

- **配置改动验证判据**：修改构建身份、共享常量或环境白名单后，先运行 `pnpm typecheck` 与 `pnpm verify:prebuild` 确认静态门禁通过；打包相关字段改动（如 `name`、`appId`、`MAX_ASAR_SIZE_MB`）需执行 `pnpm build:unpack` 触发 `verify:postbuild` 验证产物与 ASAR 体积；开发端口调整则重启 `pnpm dev` 核对终端端点输出。
- **区分 `MODE` 与 `app.isPackaged`**：`MODE=production` 控制逻辑行为（加载 `dist` 静态 HTML、启用生产 CSP），`app.isPackaged` 控制物理打包态（ASAR 与真实自动更新）；`pnpm preview` 属于未打包但按生产逻辑运行。
- **应用身份与环境配置严禁混层**：`APP_IDENTITY` 与 `APP_DISPLAY` 仅从根 `package.json` 推导，绝不回退读 `.env`；相对地，接口地址与监控 DSN 走 `.env` 白名单，防止仓库身份随部署环境漂移。
- **构建配置与运行期偏好严格隔离**：`userData/config.json` 与 Chromium `Local State` 只保存用户运行态数据，构建配置文件（`tsconfig`、Biome、`build/electron-builder.ts`）绝不进入用户目录或经 IPC 暴露。
- **修改 `@app/shared` 常量后的预览要求**：源码别名已直指 `src/*`，但在执行 `pnpm preview -- --skip-build` 前，若改动过 `@app/shared` 常量，必须先运行 `pnpm build` 或直接运行 `pnpm preview` 重建主进程与渲染层产物。
- **窗口几何与托盘行为联调**：修改 `window-geometry.ts` 常量后，可通过 `pnpm test:e2e` 验证超屏收缩与居中回退逻辑；修改 `tray.module.ts` 后需以 `pnpm dev` 实测系统托盘菜单与图标 DPI 清晰度。
- **跨包契约变更同步文档**：若增删配置层级、IPC 通道或构建入口脚本，须按根规则在同一 PR 内同步更新对应包 `AGENTS.md` 与本速查表。
- **本地开发与打包命令入口区分**：`pnpm dev` 与 `pnpm preview` 均经由 `scripts/dev.ts` 执行单实例与环境加载，而 `pnpm build:*` 统一经由 `scripts/build.ts` 串联前置门禁、`electron-builder` 打包与后置冒烟校验。
- **用户偏好重置边界**：若需清空本地测试状态，可删除系统 `userData` 目录下的 `config.json` 或由 Chromium 管理的 `Local State`，切勿通过修改源码默认值来充当用户偏好重置。
