# ⚡ Electron React Monorepo Template

**面向企业级生产环境、严苛工程约束与 AI Agent 协同打造的 Electron 桌面端解决方案。**

[![Electron 41](https://img.shields.io/badge/Electron-41.0.0-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite-8.0.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript 5.8](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Biome](https://img.shields.io/badge/Linter-Biome-60A5FA?logo=biome&logoColor=white)](https://biomejs.dev/)
[![LinguiJS](https://img.shields.io/badge/i18n-LinguiJS_5-E535AB)](https://lingui.dev/)
[![Playwright](https://img.shields.io/badge/Testing-Playwright-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 本模板解决了什么

本模板不是简单的脚手架演示，而是针对桌面软件工程痛点打造的工业级生产基座：

| 软件工程痛点 | 模板内置解决方案 | 核心架构收益 |
| :--- | :--- | :--- |
| **首屏加载白闪、黑屏** | 构建期占位符内联与启动就绪门禁协同机制 | 窗口渲染平滑无白闪，首屏即时可见 |
| **IPC 散装裸写无类型安全** | 基于共享契约的四阶段 IPC 管道与控制器统一兜底 | 彻底杜绝调用参数错误与主进程未捕获异常 |
| **原生 C++ 模块难引入、易报错** | 主进程依赖隔离声明与特定平台原生预编译提升配置 | 解决 `usb` 等原生 Addon 在 asar 中无法加载问题 |
| **打包体积膨胀、源码易泄露** | 动态零配置打包脚本与产物安全门禁 (`verify-dist`) | 最小化交付体积，杜绝敏感配置与源码泄露 |
| **AI 编程助手产生幻觉** | 完备的工程生命周期解构文档与跨进程可观测性追踪 | 约束 AI Agent 遵守规范，秒级排查报错 |

---

## ⚡ 极速上手

### 1. 准备环境
- **Node.js**: `>= 22.12.0`
- **包管理器**: `pnpm >= 10.0.0`
- 根目录 `.npmrc` 已内置淘宝镜像源配置。

### 2. 安装依赖并启动
```bash
# 安装工作区所有依赖
pnpm install

# 启动开发模式（支持主进程与渲染进程双向热重载）
pnpm start
```

---

## 📚 软件工程生命周期与架构解构

深入了解本模板在各个软件工程阶段内置的能力与底层设计考量：

1. 🚀 [**阶段一：项目初始化与品牌定制**](docs/1-init-and-customization.md)
   - 单点元数据源自动同步、多环境安全隔离策略、pnpm 确定性依赖体系。
2. 🪟 [**阶段二：多进程架构与安全通信**](docs/2-architecture-and-multi-process.md)
   - 零信任三层进程隔离模型、端到端类型安全 IPC 管道、原生 WCO 标题栏深度融合。
3. 🔌 [**阶段三：业务功能与 Native 原生模块**](docs/3-feature-development-and-native.md)
   - 特性驱动 (Feature) 高内聚架构、Lingui 编译期宏国际化提取、pnpm 隔离下的 Native Addon 提升解包方案。
4. 🛡️ [**阶段四：质量保障、调试与 AI 自动化**](docs/4-testing-quality-and-ai-review.md)
   - 跨进程结构化日志与可观测性、三层测试金字塔（Biome/Vitest/Playwright）、AI 驱动的 PR 审查闭环工作流。
5. 📦 [**阶段五：打包构建、签名与增量热更**](docs/5-build-release-and-ota.md)
   - 动态零配置打包脚本、生产产物烟雾探测门禁、自动化代码签名与差分增量 OTA 升级闭环。

---

## 🤖 AI Agent 协同指南

如果你正在使用 Cursor, Claude Code, Gemini Antigravity 等 AI 编程助手：
- 智能体行动守则与五大硬性红线：👉 [**`AGENT.md`**](AGENT.md)。
- 团队贡献与 PR 评审规范：👉 [**`CONTRIBUTING.md`**](CONTRIBUTING.md)。
