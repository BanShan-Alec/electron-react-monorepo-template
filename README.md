<div align="center">

# ⚡ Electron React Monorepo Template

**面向现代化企业级生产环境、严苛工程约束与 AI Agent 协同打造的 Electron 桌面端解决方案**

[![Electron 41](https://img.shields.io/badge/Electron-41.0.0-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite-8.0.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript 5.8](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Biome](https://img.shields.io/badge/Linter-Biome-60A5FA?logo=biome&logoColor=white)](https://biomejs.dev/)
[![LinguiJS](https://img.shields.io/badge/i18n-LinguiJS_5-E535AB)](https://lingui.dev/)
[![Playwright](https://img.shields.io/badge/Testing-Playwright-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 🌟 为什么选择本模板？

市面上现存的大多数 Electron 模板停留在“能跑起来”的玩具阶段，在面对复杂的工业生产、合规安全与 AI 协同开发时暴露出大量工程痛点。本模板通过架构裁决（ADR）解决了一系列核心难题：

| 传统脚手架痛点 | 本模板的工程解决方案 | 核心收益 |
| :--- | :--- | :--- |
| **首屏加载白闪、黑屏** | 采用构建期占位符内联与启动就绪门禁协同（ADR-0001/0002/0003） | 窗口呈现瞬间立即可见无闪烁，骨架屏平滑过渡 |
| **IPC 散装裸写、参数无校验、易崩溃** | 契约先行：`Zod 校验 ➔ Service 业务 ➔ Result<T>` 4 阶段流水线 | 渲染端完全类型安全，主进程统一防御性兜底 |
| **打包体积膨胀、asar 泄露源码** | 根依赖严格隔离、SourceMap 自动剥离与 CI 产物安全门禁 (`verify-dist`) | 最小化最终分发体积，杜绝源代码泄露风险 |
| **原生 C++ 模块难引入、易报错** | 主进程单独声明 + Vite external 双向严格对齐门禁 (`verify-deps`) | 轻松引入 `node-usb`、`serialport` 等硬件底层库 |
| **AI Agent 协同频繁幻觉、乱加依赖** | 全球首发根目录 `AGENT.md` 与跨进程分布式追踪日志手册 | Agent 严格守规，秒级通过 TraceId 排查异常 |

---

## ⚡ 30 秒极速上手

### 1. 环境准备
- **Node.js**: `>= 22.12.0`（推荐 `v22.22.x`）
- **包管理器**: `pnpm >= 10.0.0`

> [!NOTE]
> 国内网络环境下，请确保已配置 npmmirror 源。

### 2. 克隆与安装依赖

```bash
git clone https://github.com/your-org/electron-react-monorepo-template.git my-desktop-app
cd my-desktop-app

# 安装工作区所有依赖
pnpm install
```

### 3. 启动开发模式

```bash
pnpm start
```
Vite 开发服务器与 Electron 主进程将自动编译启动，默认开启双向 HMR 与热重载。

---

## 🎨 快速定制为你自己的应用

克隆本模板后，只需几个简单步骤即可重命名并定制为你自己的商业应用：

1. **一键定制指导**：请查阅 👉 [**项目定制与品牌重塑指南**](docs/template-customization-guide.md)，修改应用名、包名、AppID 与图标；
2. **多语言配置**：请查阅 👉 [**国际化 (i18n) 开发手册**](docs/i18n/guide.md)，源码直接书写中文，一键宏提取；
3. **依赖规范**：请查阅 👉 [**依赖安装与引入铁律**](docs/dependency-rules.md)。

---

## 🤖 AI Agent 协同与调试开发

如果你正在使用 **Cursor**, **Windsurf**, **Claude Code**, **Gemini Antigravity** 等 AI 编程助手：

- **AI 智能体行动守则**：直接为 Agent 加载 👉 [**`AGENT.md`**](AGENT.md)；
- **排错与日志分析**：查阅 👉 [**AI Agent 日志与排错手册**](docs/guides/agent-debugging-and-logs.md)，通过 `trace_id` 关联跨进程日志，秒级排查报错。

---

## 📖 实战开发指南矩阵 (`docs/guides/`)

我们为你准备了生产开发全流程的最佳实践实操文档：

- 🔌 [**原生 C++ 模块接入与打包指南（以 USB 为例）**](docs/guides/native-modules.md)：学习如何安全引入原生硬件扩展模块；
- 🚀 [**新增业务功能端到端开发 SOP**](docs/guides/new-feature-sop.md)：从 Shared 到 Renderer 的 4 阶段强契约开发流水线；
- 🪟 [**多窗口与 MPA 架构开发指南**](docs/guides/multi-window.md)：如何优雅实现多窗口隔离与新增独立功能窗口；
- 📦 [**打包构建、发版与 OTA 自动更新指南**](docs/guides/release-and-ota.md)：涵盖跨平台打包、GitHub Releases 与热更新。

---

## 🏛️ 架构深度解析

想要深入探究本模板背后的技术裁决、跨进程 IPC 模型、启动协调机制与安全防护？  
请阅读我们的架构全景文档与决策记录：

- 📐 [**架构深度全景指南 (Architecture Overview)**](docs/architecture-overview.md)
- 📜 [**架构决策记录 (ADR 索引)**](docs/adr/)
- 🤝 [**贡献指南与 PR 评审规范**](CONTRIBUTING.md)

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源发布。
