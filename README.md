# ⚡ Electron React Monorepo Template

**面向企业级生产环境、严苛工程约束与 AI Agent 协同打造的现代桌面端解决方案。**

[![Electron 41](https://img.shields.io/badge/Electron-41.0.0-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite-8.0.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript 5.8](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Biome](https://img.shields.io/badge/Linter-Biome-60A5FA?logo=biome&logoColor=white)](https://biomejs.dev/)
[![LinguiJS](https://img.shields.io/badge/i18n-LinguiJS_5-E535AB)](https://lingui.dev/)
[![Playwright](https://img.shields.io/badge/Testing-Playwright-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 为什么选择本模板？(对比 electron-vite 空白模板)

本模板不是简单的脚手架演示，而是以**前端软件工程化完整度**为核心目标的工业级生产底座：

| 维度名称 | 关注的核心问题 | 对应在模板中的具体工程实践 |
| :--- | :--- | :--- |
| **1. 根目录拓扑与工程治理** | 根目录结构整洁度、工具链配置收敛、依赖隔离机制 | - 所有工具配置收敛至 `.config/`，CI/CD 收敛在 `.github/`，构建与验证位于 `build/` 与 `scripts/`<br>- 业务逻辑由 `packages/*` 物理隔离，根目录零依赖污染<br>- 统一使用 `pnpm Workspaces` 符号链接物理隔离，彻底杜绝幽灵依赖 |
| **2. 跨进程通信与契约体系** | 进程间通信安全、入参校验、端到端类型流转、异常兜底 | - `@app/shared` 先行定义强类型通道与接口契约，杜绝手写裸 string IPC<br>- Main `BaseController` 自动拦截异常并统一包装返回 `Result<T>`，防崩溃兜底<br>- Preload 白名单隔离，Renderer 享有 100% 完整 TypeScript 类型推导 |
| **3. 代码规范与配置继承基座** | 检查耗时、规则统一性、多包 TS 配置复用 | - 独立 `@app/tsconfig` 继承包，导出 `base.json`, `node.json`, `react.json` 作为全局编译单一事实源<br>- 纯 Rust Biome 统一格式化与检查，毫秒级反馈，无 ESLint/Prettier 规则冲突<br>- Git 提交强制校验 Conventional Commits 汉字规范 |
| **4.0 双进程开发流水线与调试基座** | 开发态构建速度、端口探测、进程协同、自动化调试 | - `scripts/dev.ts` 智能有序调度，先行启动 Vite DevServer，再安全拉起 Electron<br>- `scripts/port-guard.ts` 自动探测并防范端口占用冲突<br>- 主进程启动自动注入 `--remote-debugging-port=9222`，为 Playwright 与远程 DevTools 开放 Chrome DevTools Protocol (CDP) 调试端口 |
| **4.1 业务架构与代码组织 (渲染进程)** | 页面扩展、组件内聚性、多窗口入口设计、组件模板规范 | - `src/entries/{home, updater}` MPA 物理入口设计，独立轻量窗口无需加载主应用沉重依赖<br>- `src/features/*` 领域特性驱动架构，高内聚独立组件、Hook 与状态<br>- 严格执行官方“七段式”组件规范与展示卡片 `memo` 模式，杜绝 Barrel 桶文件 |
| **4.2 业务架构与代码组织 (主进程)** | 后台服务组织、生命周期解耦、模块化扩展 | - 自研微内核 `ModuleRunner` 链式执行器，将混乱的 Electron 原生事件生命周期解耦为可插拔的 `AppModule`<br>- Controller 与 Service 严格分立：Controller 负责 IPC 路由与参数防御，Service 承载纯业务逻辑并支持独立单元测试 |
| **5.1 应用级基础设施 (渲染进程)** | UI 生态、轻量路由、多语言国际化、全局状态 | - 深度融合 Ant Design v6（企业级交互规范与无障碍基座）与 Tailwind CSS（原子化实用布局工具类）<br>- Lingui v5 源码直接书写母语文本，编译期 AST 宏自动提取生成 PO 词条，杜绝漏译空白<br>- 引入 1.5KB 极致轻量微内核路由 `wouter` 与轻量响应式状态流 `Zustand` |
| **5.2 应用级基础设施 (主进程)** | 系统日志、分布式追踪、窗口控制与原生贴靠 | - 内置 W3C 分布式追踪系统 (`telemetry/tracer.ts`)，基于 AsyncLocalStorage 自动注入 `trace_id` 与 `span_id` 实现跨进程全链路染色<br>- `electron-log` 本地文件纯英文滚动轮转，结合 Sentry 实现崩溃自动脱敏捕获<br>- 深度融合原生 Window Controls Overlay (WCO)，保留 Win 11 Snap 原生贴靠布局与双击最大化 |
| **6. 性能防御与安全隔离** | 沙箱隔离、XSS/RCE 防御、路径偏移陷阱、分包策略与 asar 体积监控 | - 强启 `contextIsolation` 与 `sandbox` 沙箱，阻断前端 XSS 逃逸至操作系统 RCE<br>- 全库彻底根除危险的 `process.cwd()`，统一采用 `__dirname` 计算相对路径，消除桌面快捷方式启动的工作目录偏移陷阱<br>- Vite `manualChunks` 拆分 `vendor-react` 与 `vendor-antd`；`scripts/verify-dist.ts` 内置 `MAX_ASAR_SIZE_MB` 打包体积防劣化门禁 |
| **7. 自动化测试与质量矩阵** | 单元测试、端到端真实桌面测试、覆盖率保障 | - 分层测试金字塔：Vitest 覆盖纯函数、工具类与状态计算单元测试<br>- Playwright 真实桌面端 E2E 黑盒测试：启动真实 Electron 窗口，探测虚拟 DOM 无法捕获的首屏白屏、预加载脚本注入与窗口交互 |
| **8. 构建交付与 GitHub CI/CD 门禁** | 动态打包、安装包体积、产物烟雾探测、差分热更、GitHub 流水线防劣化 | - 采用强类型 TypeScript 动态打包脚本 (`build/electron-builder.ts`)，动态根据环境出包并过滤敏感 SourceMap<br>- 打包后自动执行 `verify-dist.ts` 静默烟雾探测真实原生可执行文件完整性<br>- GitHub Actions 五大 CI Checks 门禁全绿才允许合入；集成 `electron-updater` 支持无感差分增量 OTA 热更新 |
| **9. AI Agent 协同工程化** | AI 编码边界、上下文治理、自动评审与闭环修复 | - 根目录 `AGENT.md` 注入架构拓扑快照与五大硬性红线，将 AI 探索空间锁死在合规管道内<br>- 专属 `@app/pr-review` 命令行套件深度联动 OpenCodeReview，在本地生成结构化 Markdown 审查看板，形成 AI 自动审查与精准修复闭环 |

---

## ⚡ 极速上手

### 1. 环境准备
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

1. 🚀 [**阶段一：根目录拓扑与工程规范体系**](docs/1-init-and-customization.md)
   - 根目录收敛架构、pnpm 单一事实源、`@app/tsconfig` 统一继承基座、Rust Biome 静态卡点。
2. 🪟 [**阶段二：多进程通信契约与主进程开发调度**](docs/2-architecture-and-multi-process.md)
   - 契约先行四阶段强类型 IPC 管道、`scripts/dev.ts` 智能调度与 CDP 调试暴露、主进程自研 `ModuleRunner` 微内核。
3. 🔌 [**阶段三：渲染进程架构、组件规范与基础设施选型**](docs/3-feature-development-and-native.md)
   - MPA Entries 多物理入口、Feature 架构、渲染进程“七段式”组件编写规范、AntD v6 + Tailwind + Lingui v5 选型理由。
4. 🛡️ [**阶段四：质量工程、分布式追踪与 AI 自动化协同**](docs/4-testing-quality-and-ai-review.md)
   - W3C 分布式追踪系统 (`trace_id` 与 `span_id` 全链路染色)、Vitest + Playwright 测试金字塔、`AGENT.md` 五大红线与 `pr-review` OCR 闭环。
5. 📦 [**阶段五：性能防御、构建交付与 CI/CD 自动化门禁**](docs/5-build-release-and-ota.md)
   - manualChunks 分包与 `verify-dist.ts` asar 体积门禁、TypeScript 动态打包、GitHub Actions 五大门禁与差分 OTA 闭环。

---

## 🤖 AI Agent 协同指南

如果你正在使用 Cursor, Claude Code, Gemini Antigravity 等 AI 编程助手：
- 智能体行动守则与五大硬性红线：👉 [**`AGENT.md`**](AGENT.md)。
- 团队贡献与 PR 评审规范：👉 [**`CONTRIBUTING.md`**](CONTRIBUTING.md)。
