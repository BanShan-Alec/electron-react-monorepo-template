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

| # | 工程化维度 | 维度核心关注点 | electron-vite 空白模板现状 | 本模板做到了什么 (Why & What) | 选型库及核心理由 |
| :- | :--- | :--- | :--- | :--- | :--- |
| **1** | **根目录拓扑与工程治理** | 根目录规整度、工具链收敛、目录树清晰度 | **配置散落根目录，单体 flat 结构**<br>根目录充斥各种 dot-files；所有逻辑塞在 `src/`。*(注：pnpm 优势众所周知，一句带过)* | **极致收敛的拓扑树**<br>工具链收敛至 `.config/`；CI/CD 位于 `.github/`；构建与验证位于 `build/` 与 `scripts/`；多包由 `packages/` 承载。 | **pnpm Workspaces**<br>一句话带过：符号链接天然隔离，根治幽灵依赖。 |
| **2** | **跨进程通信与契约体系** | 通信安全、入参校验、端到端类型流转、异常兜底 | **裸写 string IPC**<br>`ipcRenderer.send('msg', data)` 散装字符串；无类型校验；主进程未捕获异常导致闪退。 | **契约先行 (Contract-First) 四阶段强类型 IPC 管道**<br>`@app/shared` 定义通道与接口；Main `BaseController` 自动拦截异常并返回 `Result<T>`；Renderer 享有 100% 完整类型推导。 | **TypeScript + Zod**<br>编译期静态推导 + 运行时防御性参数校验；严禁使用未受控的原始 IPC。 |
| **3** | **代码规范与配置继承基座** | 检查耗时、规则统一性、多包 TS 配置复用 | **传统 ESLint + Prettier，TS 配置到处复制**<br>双工具堆叠慢；子包内手工维护冗长的 `tsconfig.json`，多包配置漂移。 | **纯 Rust Biome 极速工具链 + `@app/tsconfig` 继承包**<br>统一由 `@app/tsconfig` 导出 `base.json`, `node.json`, `react.json`；子包 `extends` 复用，保证全局编译器选项统一；毫秒级 Biome 检查。 | **Biome + `@app/tsconfig`**<br>- 统一 TS 编译规范单一事实源<br>- Biome 单二进制提速 20~30 倍，零配置冲突。 |
| **4.0** | **双进程开发流水线与调试基座** | 开发态构建速度、端口探测、进程协同、自动化调试 | **简单并发启动，易端口冲突，断点难挂**<br>`concurrently` 简单启动两个进程；无智能端口防占用；无 Chrome DevTools Protocol (CDP) 调试暴露。 | **`scripts/dev.ts` 智能调度 + CDP 调试端口自动化**<br>`port-guard.ts` 自动探测占用；先行启动 Vite DevServer；Electron 启动时自动注入 `--remote-debugging-port=9222`，为 Playwright 与远程 DevTools 开放 CDP 调试能力。 | **Vite 8 + `scripts/dev.ts` + CDP**<br>秒级双向 HMR；端口冲突自动防御；CDP 原生对接自动化与底层调试工具。 |
| **4.1** | **业务架构与代码组织<br>(渲染进程)** | 页面扩展、组件内聚性、多窗口入口设计、组件模板规范 | **单页平铺 + 简单 React 示例**<br>所有组件扔在 `components/`，页面增加后目录混乱；单入口 SPA 无法支持多窗口。 | **特性驱动 (Feature) + MPA Entries 架构 + 七段式组件模板**<br>`src/entries/{home, updater}` 支持多独立窗口；严格遵循 `Xxx/index.tsx` 一组件一目录；组件内部严格遵循私有常量→解构→状态→IPC→转换→Effect→Render 的七段式规范。 | **MPA Entries + 七段式组件**<br>保证单功能高内聚与清晰生命周期边界；展示卡片标准 `memo` 导出，规避性能陷阱。 |
| **4.2** | **业务架构与代码组织<br>(主进程)** | 后台服务组织、生命周期解耦、模块化扩展 | **所有逻辑堆砌在 `main/index.ts`**<br>一个文件上千行，窗口创建、托盘、IPC 监听与系统事件完全纠缠。 | **自研微内核 `ModuleRunner` + 控制器/服务分立**<br>基于 `createModuleRunner().init(...)` 链式加载，将 Electron 原生事件生命周期解耦为高内聚独立模块 (`AppModule`)；通过 `Controller` 与 `Service` 实现路由调度与纯系统逻辑彻底分离。 | **自研 ModuleRunner 模式**<br>彻底化解 Electron 生命周期混乱堆叠，支持各模块独立启停与纯单元测试。 |
| **5.1** | **应用级基础设施<br>(渲染进程)** | UI 生态、轻量路由、多语言国际化、全局状态 | **无路由、无状态、无多语言方案**<br>需要开发者手动去拼装 React 生态，不同人写出不同的状态逻辑。 | **生产级轻量渲染基建全家桶**<br>- UI：深度融合 AntD v6 (企业级交互/设计变量/无障碍基座) + Tailwind CSS (原子化实用样式辅助)<br>- 路由：轻量级微内核路由 (wouter 1.5KB，无侵入)<br>- 国际化：源码直接写中文，编译期 AST 宏自动抽取 (Lingui v5)<br>- 状态：轻量响应式状态流 (Zustand)。 | **AntD v6 + Tailwind + Lingui v5 + wouter**<br>- AntD v6 奠定企业级规范<br>- Tailwind 解决定制细节<br>- Lingui 解决词条漏译空白<br>- wouter 极致减重。 |
| **5.2** | **应用级基础设施<br>(主进程)** | 系统日志、分布式追踪、窗口控制与贴靠 | **原生普通窗口，无日志与链路追踪体系**<br>`console.log` 随处打印，生产环境无日志落盘，无法定位跨进程链路。 | **系统级原生基建 + W3C 分布式日志追踪**<br>- 日志：`electron-log` 本地轮转落盘<br>- 追踪：内置 `Tracer` 支持 `trace_id` 与 `span_id`，IPC 通信全链路染色<br>- 窗口：原生 Window Controls Overlay (WCO) 贴靠布局。 | **W3C Trace + WCO 深度集成**<br>将微服务标准的 Trace/Span 引入桌面端，排障秒级定位；保留 Win 11 Snap 原生贴靠体验。 |
| **6** | **性能与安全防御** | 沙箱隔离、XSS/RCE 防御、路径偏移陷阱、分包策略与 asar 体积监控 | **安全隐患多、存在路径漂移、产物体积黑盒**<br>误用 `nodeIntegration`；直接使用 `process.cwd()` 导致快捷方式启动寻址崩溃；asar 膨胀未监控。 | **零信任沙箱 + 相对路径锁定 + 智能分包与体积门禁**<br>- 安全：强启 `contextIsolation` 与 `sandbox`<br>- 稳定：全库消除 `process.cwd()`，采用 `__dirname`<br>- 性能：Vite `manualChunks` 拆分 `vendor-react` 与 `vendor-antd`<br>- 监控：`verify-dist.ts` 内置 `MAX_ASAR_SIZE_MB` 门禁。 | **Context Isolation + asar 体积门禁**<br>阻断前端 XSS 逃逸到操作系统 RCE；防止意外引入巨型依赖导致安装包失控。 |
| **7** | **自动化测试与质量矩阵** | 单元测试、端到端真实桌面测试、覆盖率保障 | **测试基建完全空白 (0 测试)**<br>无单测，更无法针对 Electron 桌面多进程环境执行黑盒验证。 | **全栈测试金字塔 (Unit + E2E)**<br>- 模块级：Vitest 覆盖纯逻辑与状态计算<br>- 系统级：Playwright 启动真实 Electron 窗口，探测跨域、Preload 注入与真实 UI 交互。 | **Vitest 3 + Playwright**<br>- Vitest：极速复用 Vite 配置<br>- Playwright：唯一能工业级驱动真实 Chromium+Node.js 实例的桌面 E2E 工具。 |
| **8** | **构建交付与 GitHub CI/CD 门禁** | 动态打包、安装包体积、产物烟雾探测、差分热更、GitHub 流水线防劣化 | **静态配置死板，无 CI 门禁，全靠人工发包**<br>静态 JSON 难以适应多环境；没有 CI 门禁测试；没有差分升级和发布工作流。 | **全自动化 GitHub CI/CD 门禁与交付闭环**<br>- 打包：TypeScript 动态根据环境组装配置<br>- CI 门禁：`.github/workflows/ci.yml` 强制执行 lint, typecheck, test, e2e 与 CodeQL 扫描<br>- 交付：自动构建并发布 GitHub Releases，支持差分增量 OTA。 | **GitHub Actions + verify-dist + electron-updater**<br>五大 CI Checks 门禁全绿才允许合入；差分增量补丁极大降低用户更新流失率。 |
| **9** | **AI Agent 协同工程化** | AI 编码边界、上下文治理、自动评审与闭环修复 | **完全未考虑 AI 协同 (0 支持)**<br>AI 随意乱装全局依赖、裸写非安全 IPC、产生幻觉代码无法阻断。 | **全方位 Agent-Ready 工程基座**<br>- 约束：根目录 `AGENT.md` 注入拓扑快照与五大硬性红线<br>- 协作：`packages/pr-review` 工具套件与 OpenCodeReview 深度联动，本地自动生成修复看板。 | **`AGENT.md` + `@app/pr-review` (OCR 闭环)**<br>业界领先的 Agentic SE 3.0 实践，将 AI 从“不可控的黑盒补全”转化为“受严格门禁约束的合规编排”。 |

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
