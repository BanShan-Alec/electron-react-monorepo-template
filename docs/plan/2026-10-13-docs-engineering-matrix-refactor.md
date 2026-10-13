# 基于前端软件工程化 10 维对比重构文档体系详细规划

> 状态：已完成 · v3 · 2026-10-13
>
> 用户人读版：[../human/2026-10-13-docs-engineering-matrix-refactor.md](../human/2026-10-13-docs-engineering-matrix-refactor.md)

## 1. 目标和完成标准

1. **功能 1：改写 5 篇生命周期文档为 10 维工程化深度对比**
   - 标准 1.1：`docs/1-init-and-customization.md` 包含根目录完整拓扑树，说明配置收敛至 `.config/`、脚本收敛至 `scripts/` 的设计；pnpm 一句话带过；深度说明 `@app/tsconfig` 统一继承基座与 Biome 工具链。
   - 标准 1.2：`docs/2-architecture-and-multi-process.md` 包含 `scripts/dev.ts` 智能端口守护与 CDP 调试暴露（端口 9222）；阐述主进程自研 `ModuleRunner` 链式加载与 `BaseController`/`Service` 分立；包含 IPC 契约先行管道与 Mermaid 架构图。
   - 标准 1.3：`docs/3-feature-development-and-native.md` 包含 MPA `entries/` 架构；包含 Feature 领域内聚与渲染进程官方“七段式”组件标准模板（以 `UsbCard` 为例）；阐述 AntD v6 企业设计规范 + Tailwind 原子化样式 + Lingui v5 + wouter 的选型权衡。
   - 标准 1.4：`docs/4-testing-quality-and-ai-review.md` 包含主进程 W3C 分布式追踪系统（`tracer.ts` 注入 `trace_id` 与 `span_id` 全链路染色）；阐述 Vitest + Playwright 真实 Electron 窗口测试金字塔；阐述 `AGENT.md` 五大红线与 `pr-review` OCR 闭环。
   - 标准 1.5：`docs/5-build-release-and-ota.md` 包含性能分包（Vite `manualChunks` 拆分 react 与 antd）；包含 `verify-dist.ts` 的 `MAX_ASAR_SIZE_MB` 体积防劣化监控门禁；包含 GitHub Actions 五大 CI Checks 门禁与差分 OTA 闭环。
   - 标准 1.6：各文档文字严格遵循 ASD-STE100 规范：短句、主动语态、一词一名、宏观讲清机制与理由，不扣琐碎代码细节。

2. **功能 2：更新主页 README.md 与 AGENT.md**
   - 标准 2.1：`README.md` 完整嵌入 10 维工程化对比矩阵表格。
   - 标准 2.2：`AGENT.md` 索引对齐 10 维结构。

## 2. 背景与约束

- 严格遵守用户的最新要求：
  - 维度 1 从根目录拓扑树展开，说明配置收敛，pnpm 好处一句话带过。
  - 维度 3 说明为何单独引入 `@app/tsconfig`。
  - 增加 4.0 讲述 `scripts/dev.ts` 双进程调度与 CDP 调试端口（9222）。
  - 4.1 引入 MPA entries 入口，并给出渲染进程官方七段式组件模板。
  - 4.2 讲清主进程自研 `ModuleRunner` 链式微内核与 Controller/Service 分层，严禁套用外部无关框架名词。
  - 5.1 说明 AntD v6 企业规范与 Tailwind 搭配理由。
  - 5.2 说明系统日志与 W3C Trace/Span 链路染色。
  - 6 补充渲染进程 manualChunks 分包与 `verify-dist.ts` asar 体积门禁。
  - 8 补充 GitHub CI/CD 门禁流水线。
- 遵循 ASD-STE100 规范与 Mermaid 架构可视化。

## 3. 方案与关键决策

- 将 10 个维度合理分布在 5 篇生命周期文档中，每篇承载 2 个强相关维度，保证结构紧凑、易读性极佳。
- 根目录 `README.md` 作为全景导读，直接呈现 10 维高清矩阵表格，点击即可直达对应章节深度剖析。

## 4. 改动清单与影响面

### 改动清单
- 修改：`docs/1-init-and-customization.md`
- 修改：`docs/2-architecture-and-multi-process.md`
- 修改：`docs/3-feature-development-and-native.md`
- 修改：`docs/4-testing-quality-and-ai-review.md`
- 修改：`docs/5-build-release-and-ota.md`
- 修改：`README.md`
- 修改：`AGENT.md`

### 影响面四行
- 会改：上述 7 个文档文件。
- 新增：无代码新增。
- 删除：无。
- 对外行为：全面升级为 10 维前端软件工程化视角下的深度架构文档。

## 5. 步骤

1. 改写 `docs/1-init-and-customization.md`（维度 1 根目录拓扑 + 维度 3 tsconfig 与 Biome）。
2. 改写 `docs/2-architecture-and-multi-process.md`（维度 2 IPC 契约 + 维度 4.0 dev调度与CDP + 维度 4.2 主进程自研微内核）。
3. 改写 `docs/3-feature-development-and-native.md`（维度 4.1 MPA与七段式组件 + 维度 5.1 渲染基建选型）。
4. 改写 `docs/4-testing-quality-and-ai-review.md`（维度 5.2 W3C分布式日志 + 维度 7 测试金字塔 + 维度 9 AI Agent 协同）。
5. 改写 `docs/5-build-release-and-ota.md`（维度 6 性能分包与 asar 监控 + 维度 8 TS打包与 GitHub CI 门禁）。
6. 更新 `README.md` 嵌入 10 维对比完整表格与 `AGENT.md`。
7. 运行 `pnpm lint` 验证格式并提交。

## 6. 风险处理与停下条件

- 停下条件：无。

## 7. 不做的事

- 不在文档中填充繁琐的安装教程；不贴无意义的长篇业务代码。

## 8. 待用户决定的问题

无需决定，回复“批准”即可开始。

## 9. 需要用户做的事

无。

## 10. 变更记录

- 2026-10-13 v3: 按照 10 维前端工程化矩阵全面规划。

## 11. 执行记录

待执行。
