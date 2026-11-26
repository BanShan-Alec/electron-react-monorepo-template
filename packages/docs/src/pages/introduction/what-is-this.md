---

title: 什么是解决方案合集（Introduction）
description: 本站定位、刚性验证门禁与维度索引入口——阅读解法前的核心约定。
---

# 什么是解决方案合集（Introduction）

> **TL;DR**：本站是 `electron-react-monorepo-template` 的工程解法速查目录，所有决策与源码直链均绑定当前仓库真实实现并受 CI 与打包门禁验证。

**边界声明**：本页负责说明文档站的定位、验证门禁与维度索引；不负责本地环境启动步骤（见 [快速上手](/introduction/getting-started)）或各模块实现细节（按下方维度跳转）。

这不是一份「如何写 Electron Hello World」的基础教程，而是一份**面向桌面端工程落地的解法目录**。与仅提供打包骨架的脚手架不同，本仓库将完整工程基座收敛在同一单仓内并附带可核验的源码入口：

- **界面与原生窗口体验**：基于 Windows 窗口控制叠加层（WCO，Window Controls Overlay）定制标题栏，规范参见 [原生窗口体验（WCO）](/ui/wco)。
- **沙箱与安全基线**：启用渲染进程沙箱、上下文隔离（`contextIsolation`）与内容安全策略（CSP，Content Security Policy），规范参见 [内容安全策略（CSP）](/security/csp)。
- **环境管道与链路追踪**：采用 URL 安全的 Base64URL 跨进程环境变量编码，以及符合 W3C Trace Context 规范的跨进程日志链路追踪，参见 [环境变量管理](/engineering/env-vars) 与 [全链路追踪](/main/tracing)。
- **打包体积防劣化**：以 Electron 归档文件 `app.asar` 总量 10 MB 作为打包后置硬门禁（分包本身不设独立配额），参见 [分包与体积门禁](/security/bundle-budget)。

## 验证标准与真实门禁

为避免示例只在开发态可用、进入真实打包后暴露路径或沙箱故障，本仓库解法均接受以下门禁校验，并可直接在本地复现：

- **日常静态与单测门禁**：运行 `pnpm typecheck && pnpm lint && pnpm test && pnpm verify:prebuild` 校验全仓类型、Biome 规则、单元测试及预构建检查（源码见 [scripts/verify-prebuild.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/verify-prebuild.ts)）。
- **打包产物冒烟与 ASAR 体积校验**：运行 `pnpm build:unpack && pnpm verify:postbuild` 检查 `app.asar` 总体积（默认阈值 `MAX_ASAR_SIZE_MB = 10`）与 `app-update.yml` 完整性，并启动解包二进制等待首屏就绪标记（源码见 [scripts/verify-postbuild.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/verify-postbuild.ts)）。
- **端到端真实窗口回归**：通过 Playwright 的 `electron.launch` 拉起**真实 Electron 窗口**执行断言，而非无头网页模拟；运行 `pnpm test:e2e:build` 可在本地复现（辅助封装见 [e2e/helpers/electron.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/e2e/helpers/electron.ts)）。
- **三平台物理打包与持续集成**：GitHub Actions 在 Windows / macOS / Linux 矩阵构建 NSIS / DMG / DEB 产物（见 [release.yml](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.github/workflows/release.yml)），PR 合并前须通过五项并发检查（见 [ci.yml](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.github/workflows/ci.yml)）。

## 仓库同源与 AI 检索入口

本站内容与 [electron-react-monorepo-template](https://github.com/BanShan-Alec/electron-react-monorepo-template) 仓库源码同源维护，阅读与协作时遵循以下约定：

- **源码真源绑定**：文档中的核心机制片段均来自仓库真实实现并附 GitHub 直链；若遇到文档与代码差异，以当前仓库源码与各包 `AGENTS.md` 为准。
- **一页一层原则**：每个解法页只覆盖一个技术层（前言、工程化、开发体验、架构、界面、主进程、安全、测试、交付），不跨层堆砌细节，跨模块边界以站内链接跳转。
- **大模型纯文本索引**：构建产物自动输出 `llms.txt`（目录索引）与 `llms-full.txt`（全站正文拼接），供 AI 编程助手直接按需检索；协作流程见 [与 AI 协作（Agent-ready）](/introduction/ai-collaboration)。

## 维度索引与下一步

建议阅读顺序：首次把仓库跑起来先读「快速上手」，准备基于模板新建自有项目先读「使用此模板」，排查具体配置落在哪一层先查「配置项归属」。

| 关注维度   | 涵盖内容                                | 推荐入口                                                           |
| :--------- | :-------------------------------------- | :----------------------------------------------------------------- |
| 本地上手   | 环境基线、启动开发态与生产预览          | [快速上手（Getting Started）](/introduction/getting-started)       |
| 模板改造   | 将模板转化为自有项目、清理仓库坐标      | [使用此模板（Use-this-template）](/introduction/use-this-template) |
| 工程基座   | Monorepo 依赖、配置归属、代码与提交规范 | [配置项归属（Configuration-map）](/dx/configuration-map)           |
| AI 协同    | 分层规则路由、全栈开发 SOP 与产出验收   | [与 AI 协作（Agent-ready）](/introduction/ai-collaboration)        |
| 交付与测试 | 分包预算、Electron E2E 与发版流水线     | [CI 并行门禁（GitHub-Actions）](/delivery/ci-gates)                |
