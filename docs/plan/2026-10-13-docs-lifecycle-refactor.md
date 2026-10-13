# 依据软件工程生命周期重构文档体系详细规划

> 状态：已完成 · v1 · 2026-10-13
>
> 用户人读版：[../human/2026-10-13-docs-lifecycle-refactor.md](../human/2026-10-13-docs-lifecycle-refactor.md)

## 1. 目标和完成标准

1. **功能 1：新建 5 篇生命周期文档**
   - 标准 1.1：`docs/1-init-and-customization.md` 存在，涵盖环境安装、品牌标识修改与多环境配置。
   - 标准 1.2：`docs/2-architecture-and-multi-process.md` 存在，涵盖三层进程模型、端到端类型安全 IPC 与 WCO/多窗口。
   - 标准 1.3：`docs/3-feature-development-and-native.md` 存在，涵盖新功能新增 SOP、Lingui v5 国际化与 Native C++ 模块。
   - 标准 1.4：`docs/4-testing-quality-and-ai-review.md` 存在，涵盖日志排查、自动化测试与 PR Review 闭环。
   - 标准 1.5：`docs/5-build-release-and-ota.md` 存在，涵盖零配置构建、代码签名与 OTA 自动升级。
   - 标准 1.6：所有新文档语言规范清晰，单句聚焦，无空泛行话。

2. **功能 2：清理冗余旧文档与归档**
   - 标准 2.1：远端已存在归档分支 `archive/docs-adr-and-specs` 与标签 `archive-docs-before-refactor`。
   - 标准 2.2：`docs/adr/` 目录被完全移除。
   - 标准 2.3：`docs/guides/`、`docs/i18n/` 及根级散装文档被安全清理。

3. **功能 3：精简根目录主入口**
   - 标准 3.1：根目录 `README.md` 与 `AGENT.md` 导航均更新为对应 5 篇阶段文档。
   - 标准 3.2：所有 markdown 内部链接全部有效，无死链。

## 2. 背景与约束

- 用户明确反馈：使用者不关心历史 ADR 与分散的规范，希望从软件工程流程和场景痛点出发，重构为易读、实用的文档结构。
- 遵循 `AsherHou/asd-ste100-for-coding` 规范：写作短句、主动语态、一词一名，消除行话与冗长废话。
- 严禁影响任何现有的项目构建代码与业务逻辑。

## 3. 方案与关键决策

- 决策 1：将旧文档全量状态通过 Git 分支与 Tag 完成归档推送，确保随时可检索历史。
- 决策 2：文档架构收敛为 5 个核心阶段文件，每个文件遵循“痛点问题 -> 解决方案与实操 -> 避坑指南”统一结构。
- 决策 3：根目录 `README.md` 转型为极简门面，只放特性矩阵与 5 大阶段文档入口。

## 4. 改动清单与影响面

### 改动清单
- 新建：`docs/1-init-and-customization.md`
- 新建：`docs/2-architecture-and-multi-process.md`
- 新建：`docs/3-feature-development-and-native.md`
- 新建：`docs/4-testing-quality-and-ai-review.md`
- 新建：`docs/5-build-release-and-ota.md`
- 修改：`README.md`
- 修改：`AGENT.md`
- 删除：`docs/adr/*`（6 篇）
- 删除：`docs/guides/*`（5 篇）
- 删除：`docs/i18n/*`（2 篇）
- 删除：`docs/architecture-overview.md`
- 删除：`docs/dependency-rules.md`
- 删除：`docs/environment-specification.md`
- 删除：`docs/module-and-runtime-specification.md`
- 删除：`docs/template-customization-guide.md`
- 删除：`docs/wco-native-titlebar-integration.md`

### 影响面四行
- 会改：`README.md`、`AGENT.md`，共 2 个文件。
- 新增：5 篇生命周期文档，以及 2 份计划文件。
- 删除：`docs/adr/`、`docs/guides/`、`docs/i18n/` 及 6 个旧规范文档，共计 19 个旧文档。
- 对外行为：无运行时代码变更；仓库文档结构精简为 5 阶段模型。

## 5. 步骤

1. 编写 5 篇生命周期文档：
   - 编写 `docs/1-init-and-customization.md`
   - 编写 `docs/2-architecture-and-multi-process.md`
   - 编写 `docs/3-feature-development-and-native.md`
   - 编写 `docs/4-testing-quality-and-ai-review.md`
   - 编写 `docs/5-build-release-and-ota.md`
2. 删除旧目录与旧文件：
   - 运行 git rm 删除 `docs/adr/`、`docs/guides/`、`docs/i18n/` 及旧 `.md` 文件。
3. 更新根目录入口：
   - 更新 `README.md` 与 `AGENT.md` 文档索引。
4. 本地验证与检查：
   - 运行 `pnpm lint` 验证文档格式。
   - 检查所有内部链接跳转。

## 6. 风险处理与停下条件

- 风险 1（历史资料遗失）：已提前推送 `archive/docs-adr-and-specs` 分支与 `archive-docs-before-refactor` 标签消除风险。
- 停下条件：若在重构中发现有业务代码对 `docs/` 文件存在路径强依赖（如自动读取文档内容），立即停下。

## 7. 不做的事

- 不修改任何业务逻辑与应用配置。
- 不改写任何历史 git commit。

## 8. 待用户决定的问题

无。

## 9. 需要用户做的事

无。

## 10. 变更记录

- 2026-10-13: v1 初始草案生成。

## 11. 执行记录

待执行。
