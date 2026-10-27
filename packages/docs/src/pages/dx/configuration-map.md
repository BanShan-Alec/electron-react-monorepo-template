---
title: 配置项归属（Configuration-map）
description: 一个值该改哪、改完何时生效、有什么副作用——身份字段、环境变量、开发端口、运行时常量与用户偏好的六层归属地图。
---

# 配置项归属（Configuration-map）

> **TL;DR**：一个值只有一个 owner——身份在根 `package.json`、构建在 `build/`、环境差异在 `.env`、开发编排在 `scripts/dev.ts`、常量在 `shared`/`main`、用户偏好在 ConfigStore。

## 要解决的坑

配置散落在六个地方：根 `package.json`、`.env`、`build/`、`scripts/dev.ts`、`shared`/`main` 的常量目录、`userData/config.json`。想改一个值，先要回答三个问题：改哪个文件、改完要不要重启或重建、会不会连带迁走用户数据。

最容易踩的是把「构建期」和「运行时」混为一谈：改了 `.env` 以为重启就生效，或者改了 `productName` 不知道 `userData` 目录会跟着搬家。

## 本仓库的解法

### 一个值只有一个 owner：六层归属

| 层 | 位置 | 管什么 | 生效时机 |
| :--- | :--- | :--- | :--- |
| 应用身份 / OTA 坐标 | 根 `package.json` | 应用名、appId、版本、GitHub 仓库 | 构建期 + 打包期 |
| 构建期基础设施 | `build/*.ts` | 环境加载、路径、external、Sentry、打包 | 构建期 |
| 环境差异 | `.env` / shell / CI | DSN、发布通道、API 地址、阈值 | 构建期内联 + 运行时覆盖 |
| 开发态编排 | `scripts/dev.ts` 的 `config` | dev server 端口、CDP/inspect 开关、watch 与重启 | `pnpm start` / `start:dist` |
| 运行时常量 | `packages/shared/src/constants`、`packages/main/src/constants` | 窗口几何、启动时值、超时、日志策略 | 编译进产物 |
| 用户偏好 | `userData/config.json` | 主题、语言、托盘、自动更新 | 运行时持久化 |

原则是「一个值只有一个 owner」：工具自己的 schema 文件（electron-builder / Vite / Playwright / Biome）保留原位，只把「值」抽出来共享，不要为了集中而合并文件。

### 常见改动速查

| 想改什么 | 改哪里 | 怎么生效 |
| :--- | :--- | :--- |
| 应用显示名 | 根 `package.json` `productName` | 重新构建 |
| App ID / 仓库 | `appId` / `repository.url` | 重新打包 |
| API 地址 | `.env` `API_BASE_URL` 或运行时 `APP_API_BASE_URL` | 构建 / 重启 |
| Sentry | `.env` DSN，CI 配 `SENTRY_AUTH_TOKEN` | 打包生效 |
| asar 阈值 | `.env` `MAX_ASAR_SIZE_MB`（详见[分包与体积门禁（Chunk + Asar）](/security/bundle-budget)） | 下次打包 |
| 主进程新依赖 | `pnpm --filter @app/main add [-D]`（详见[依赖管理（Monorepo）](/engineering/dependency-management) FAQ） | 默认内联；需运行时 `require` 的加入 `external` |
| 外链白名单 | `packages/shared/src/constants/security.ts` | 重建 main |
| 打包平台 / 图标 | `build/electron-builder.ts`、`build/resources/` | 重新打包 |
| Vite dev server 端口 | `scripts/dev.ts` 的 `config.rendererPort` | 重启 `pnpm start` |
| CDP 端口 | `scripts/dev.ts` 的 `config.rendererCdpPort`（注释即关闭） | 重启 |
| 主进程 inspect 端口 | `scripts/dev.ts` 的 `config.mainInspectPort`（默认注释） | 重启 |
| 开发 / 生产构建模式 | `package.json` scripts 的 `MODE` | 重启 / 重新构建 |
| E2E 超时与并发 | `.config/playwright.config.ts` | 下次运行 e2e |
| CI 必过检查 | GitHub 分支保护 + `.github/CICD.md`（五个 required checks） | 仓库设置 |

### 身份字段的连锁反应

→ 源码：[build/lib/app-identity.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/build/lib/app-identity.ts)

| 字段 | 作用 | 改动影响 |
| :--- | :--- | :--- |
| `name` | 产物文件名、OTA 资产名 | 必须全小写中划线，`verify:prebuild` 会拦 |
| `productName` | 窗口标题、托盘、快捷方式、Header | 还决定 `userData` / 日志目录名，改了会「搬家」 |
| `appId` | Windows AUMID、macOS Bundle ID | 发布后不要随便改，影响通知归属与安装身份 |
| `version` | 安装包版本、Sentry release | 走 `changelogen` 发版流程（见[发版流水线（Changelogen）](/delivery/release-pipeline)） |
| `repository.url` | OTA 发布源（owner/repo） | 自动解析，不再支持 `.env` 覆盖 |

怎么配：直接改根 `package.json`，然后 `pnpm build:app`。开发态窗口标题也会跟着变——标题由 renderer 在构建期注入 `productName`。

### 开发态配置

开发编排全部在 `scripts/dev.ts` 的一个可注释 `config` 对象里：

| 配置项 | 默认值 | 作用 |
| :--- | :--- | :--- |
| `rendererPort` | `5173` | Vite renderer dev server 端口；`strictPort` 下被占用会交给启动预检处理 |
| `rendererCdpPort` | `9222` | 传给 Electron 的 `--remote-debugging-port`，供外部 CDP 客户端连接 |
| `mainInspectPort` | 默认注释关闭（示例 `9229`） | 主进程 `--inspect-brk` 断点端口；注释掉即关闭 |

- **MODE**：`pnpm start` 注入 `development`，`pnpm start:dist` 注入 `production`；Vite build mode 跟随 `MODE`（机制见[开发编排（Vite + Electron）](/dx/dev-orchestration)）。
- **端口占用**：启动前逐个探测；交互环境提示是否结束占用进程，非交互环境直接失败，不会静默复用旧实例（见[启动预检（Single-instance + Port）](/dx/startup-preflight)）。
- **调试开关**：`mainInspectPort`、`rendererCdpPort` 注释掉即关闭对应能力，启动日志与命令行参数会一起跳过（见[远程调试端口（CDP）](/dx/debug-port)）。

### 运行时常量 vs 用户偏好

- **运行时常量**（`packages/shared/src/constants`、`packages/main/src/constants`）直接编译进产物：改完必须重建对应包，`pnpm start` 下的 HMR 不会自动带上主进程常量。shared 变更会经依赖传递，建议 `pnpm build` 或至少重建 main / renderer。
- **用户偏好**（`ConfigStore`，引擎 electron-store）通过设置页 / IPC 修改，持久化在 `userData/config.json`，运行时生效、无需重建；读盘由 shared 的 zod schema 整体校验，损坏即重置默认值（见[配置持久化（Electron-store）](/main/config-persistence)）。
- `userData` 目录名由 `productName` 派生——这也是改显示名会「搬家」的原因。

## 怎么抄

以「改三类配置」为例，三步：

1. **改身份**：直接改根 `package.json` 的 `name` / `productName` / `appId` / `version` / `repository.url`，然后 `pnpm build:app`；`name` 必须全小写中划线，`verify:prebuild` 会拦。
2. **改环境差异**：构建期默认值写 `.env`；运行时覆盖用 `APP_<KEY>`（如 `APP_API_BASE_URL`）；渲染层统一读 `window.__APP_ENV__`（注入链路见[环境变量管理（Dotenv）](/engineering/env-vars)）。
3. **改开发编排**：端口与调试开关改 `scripts/dev.ts` 的 `config`；`MODE` 由 `package.json` scripts 注入，不要写进 `.env`。

注意点：

- `.env` 是构建期默认值，不是运行时读取文件；运行时想覆盖必须用 `APP_<KEY>`。
- 渲染进程不读 `.env`（Vite 只暴露 `VITE_` 前缀），本项目统一走 `window.__APP_ENV__`。
- `MODE` ≠ `app.isPackaged`：前者是开发/生产行为语义，后者是物理打包态；`start:dist` 是「未打包但生产行为」。
- 改 `productName` 会迁移用户数据目录（`userData`、日志、`config.json`、`Local State`），发版前要想清楚。
- 窗口位置与尺寸的持久化不在这里配，见[窗口位置与尺寸（Window-state）](/ui/window-state)。
