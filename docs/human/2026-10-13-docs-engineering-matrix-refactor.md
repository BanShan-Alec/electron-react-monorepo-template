# 基于前端软件工程化 10 维对比重构文档体系

> 状态：已完成 · v3 · 2026-10-13
>
> agent 执行版：[../plan/2026-10-13-docs-engineering-matrix-refactor.md](../plan/2026-10-13-docs-engineering-matrix-refactor.md)

## 这次要做什么

1. **改写 5 篇生命周期文档为 10 维工程化深度对比**
   - 目的：不细扣操作细节，对比 electron-vite 空白模板，讲清模板做了什么、为什么选择该库与设计理由。这是你的要求。
   - 做完后：
     - `docs/1-init-and-customization.md`：涵盖【维度 1】根目录拓扑树（收敛 .config/.github 等目录）、pnpm 一句话带过、【维度 3】@app/tsconfig 继承包与 Biome。
     - `docs/2-architecture-and-multi-process.md`：涵盖【维度 2】IPC 契约与 Zod、【维度 4.0】scripts/dev 调度与 CDP 调试、【维度 4.2】主进程自研 ModuleRunner 与 Controller/Service 解耦。
     - `docs/3-feature-development-and-native.md`：涵盖【维度 4.1】MPA Entries 入口设计与渲染进程 Feature 架构（含真实七段式组件模板）、【维度 5.1】渲染基建（AntD v6 企业设计规范 + Tailwind + Lingui v5 + wouter）。
     - `docs/4-testing-quality-and-ai-review.md`：涵盖【维度 5.2】主进程 W3C 分布式日志与 Trace/Span 注入、【维度 7】测试金字塔（Vitest + Playwright）、【维度 9】AI Agent 协同工程化（AGENT.md + pr-review OCR 闭环）。
     - `docs/5-build-release-and-ota.md`：涵盖【维度 6】性能与安全（零信任沙箱、manualChunks 分包、asar 体积监控门禁）、【维度 8】TS 动态打包与 GitHub CI/CD 自动化门禁。
     - 必要处采用 Mermaid 图表表达架构流向。
     - 全文遵守 ASD-STE100 规范（短句、主动语态、一词一名、无虚词）。

2. **更新主页 README.md 与 AGENT.md**（依赖功能 1）
   - 目的：在主页完整呈现 10 维工程化对比矩阵表格，提供高能导读。
   - 做完后：
     - `README.md` 包含完整的高清对比矩阵表格。
     - `AGENT.md` 索引对齐最新 10 维架构结构。

不做：不展开手把手代码教学；不写冗余琐碎语法；不引入未实现的第三方框架概念。

## 需要你决定的事

无需决定，回复"批准"即可开始。

## 影响面

- 会改：`docs/1-*.md` 至 `docs/5-*.md`，以及 `README.md`、`AGENT.md`，共 7 个文件。
- 新增：本规划文件与执行版。
- 删除：无。
- 对外行为：文档体系全面转变为以“前端软件工程化 10 维对比与架构解构”为主轴的高清技术资产。
