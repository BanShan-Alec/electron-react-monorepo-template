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

## 🌟 解决什么问题

本模板面向真实软件工程研发流程，解决桌面开发的核心痛点：

| 研发痛点 | 模板解决方案 | 开发者收益 |
| :--- | :--- | :--- |
| **首屏加载白闪、黑屏** | 采用构建期占位符内联与启动就绪门禁协同 | 窗口呈现瞬间立即可见，骨架屏平滑过渡 |
| **IPC 散装裸写、参数无校验** | 契约先行：Shared 定义类型，Controller 统一兜底 | 渲染端完全类型安全，杜绝调用参数错误 |
| **原生 C++ 模块难引入、易报错** | 主进程独立声明，配置原生预编译二进制提升 | 轻松接入 `usb` 等硬件底层库，打包无缺失报错 |
| **打包配置复杂、体积膨胀** | 动态零配置打包脚本与产物安全门禁 (`verify-dist`) | 自动生成跨平台安装包，杜绝源代码泄露风险 |
| **AI 编程助手产生幻觉** | 提供统一规范文档与跨进程链路排错手册 | AI Agent 遵循约束，秒级排查报错 |

---

## ⚡ 极速上手

### 1. 准备环境
- **Node.js**: `>= 22.12.0`
- **包管理器**: `pnpm >= 10.0.0`
- 检查根目录 `.npmrc`，必须配置淘宝镜像源：
  ```ini
  registry=https://registry.npmmirror.com
  ```

### 2. 安装依赖并启动开发
```bash
# 1. 安装工作区所有依赖
pnpm install

# 2. 启动开发模式（支持主进程与渲染进程双向热重载）
pnpm start
```

---

## 📚 软件工程生命周期实战指南

文档按软件工程研发流程组织，请根据你的开发阶段查阅对应文档：

1. 🚀 [**阶段一：项目初始化与品牌定制**](docs/1-init-and-customization.md)
   - 环境安装规范、一处修改替换应用名/图标/AppID、多环境配置。
2. 🪟 [**阶段二：多进程架构与安全通信**](docs/2-architecture-and-multi-process.md)
   - 主进程与渲染进程职责分工、端到端类型安全 IPC、原生无边框 WCO 标题栏。
3. 🔌 [**阶段三：业务功能与 Native 原生模块**](docs/3-feature-development-and-native.md)
   - 新增页面与路由标准流程、Lingui v5 国际化多语言自动提取、C++ 原生模块极简接入。
4. 🛡️ [**阶段四：质量保障、调试与 AI 自动化**](docs/4-testing-quality-and-ai-review.md)
   - 本地日志排查路径、Vitest 单元测试、Playwright E2E 真实窗口测试、AI 代码复查工作流。
5. 📦 [**阶段五：打包构建、签名与增量热更**](docs/5-build-release-and-ota.md)
   - 跨平台零配置打包脚本、Windows/macOS 代码签名配置、增量 OTA 升级流程。

---

## 🤖 AI Agent 协同指南

如果你正在使用 Cursor, Claude Code, Gemini CLI 等 AI 编程助手：
- 请为 Agent 载入项目规范：👉 [**`AGENT.md`**](AGENT.md)。
- 团队贡献与 PR 评审规范：👉 [**`CONTRIBUTING.md`**](CONTRIBUTING.md)。
