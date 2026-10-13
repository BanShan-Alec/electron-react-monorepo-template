# 依据软件工程生命周期重构文档体系详细规划

> 状态：已完成 · v2 · 2026-10-13
>
> 用户人读版：[../human/2026-10-13-docs-lifecycle-refactor.md](../human/2026-10-13-docs-lifecycle-refactor.md)

## 1. 目标和完成标准

1. **功能 1：改写 5 篇生命周期文档为能力与设计理由说明**
   - 标准 1.1：`docs/1-init-and-customization.md` 阐述模板在初始化和定制阶段做了什么机制（如元数据单点真相、环境变量强隔离），以及为什么这样设计。
   - 标准 1.2：`docs/2-architecture-and-multi-process.md` 阐述模板在进程架构与通信上做了什么机制（如强隔离沙箱、基于通道与类型的 IPC 流水线、原生 WCO 融合），以及为什么这样设计。
   - 标准 1.3：`docs/3-feature-development-and-native.md` 阐述模板在业务开发与原生扩展上做了什么机制（如特性分层、Lingui 编译期宏提取、pnpm 隔离下的 Native Addon 提升机制），以及为什么这样设计。
   - 标准 1.4：`docs/4-testing-quality-and-ai-review.md` 阐述模板在质量保障与 AI 协同上做了什么机制（如本地多维日志追踪、Playwright 真实环境黑盒测试、全生命周期 pr-review 自动化工具套件），以及为什么这样设计。
   - 标准 1.5：`docs/5-build-release-and-ota.md` 阐述模板在构建发布与更新上做了什么机制（如零配置动态构建清单、asarUnpack 精准解包、增量 OTA 升级闭环），以及为什么这样设计。
   - 标准 1.6：文档中不包含新手教程式的步骤灌输，专注于系统能力说明和架构取舍；语言严格遵守 ASD-STE100 规范。

2. **功能 2：同步更新 README.md 与 AGENT.md 概览**
   - 标准 2.1：`README.md` 与 `AGENT.md` 准确引导用户理解模板的核心价值体系与架构权衡。

## 2. 背景与约束

- 用户的核心纠偏：“不要教用户怎么做，而是告诉用户这个 template 做了什么，为什么这样”。
- 遵守 ASD-STE100 技术写作原则：句子少于 40 字、一个代词指代一个实体、主动语态、拒绝行业黑话。

## 3. 方案与关键决策

- 每篇文档采用三段式论述模型：
  1. **工程痛点 (The Problem)**：该研发阶段在业界通常遇到的典型问题。
  2. **模板做了什么 (What This Template Does)**：模板内置了哪些技术模块、自动化工具与约束机制。
  3. **为什么这样设计 (Why We Designed It This Way)**：对比常见做法，解释背后的权衡（安全、性能、稳定性、团队协同效率）。

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
- 新增：无。
- 删除：无。
- 对外行为：文档整体定位转变为工程解决方案深度解构。

## 5. 步骤

1. 改写 `docs/1-init-and-customization.md` 为初始化与定制机制解构。
2. 改写 `docs/2-architecture-and-multi-process.md` 为进程架构与 IPC 机制解构。
3. 改写 `docs/3-feature-development-and-native.md` 为功能演进与 Native 依赖机制解构。
4. 改写 `docs/4-testing-quality-and-ai-review.md` 为质量工程与自动化审查机制解构。
5. 改写 `docs/5-build-release-and-ota.md` 为构建发布与更新机制解构。
6. 更新 `README.md` 与 `AGENT.md` 导航描述。
7. 运行 `pnpm lint` 验证格式并提交。

## 6. 风险处理与停下条件

- 停下条件：无。

## 7. 不做的事

- 不在文档中充斥保姆级教程或操作流水账代码。

## 8. 待用户决定的问题

无需决定，回复“批准”即可开始。

## 9. 需要用户做的事

无。

## 10. 变更记录

- 2026-10-13 v1: 初始生命周期重构完成。
- 2026-10-13 v2: 调整定位，从操作教程转向模板工程能力与设计理由阐述。

## 11. 执行记录

待执行。
