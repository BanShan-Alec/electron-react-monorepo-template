# @app/pr-review AGENTS.md — 工具包规则（从简）

> 人类向使用文档见 [README.md](./README.md)；全局红线与全仓任务路由见 [根 AGENTS.md](../../AGENTS.md)。

本包为 PR 生命周期与 OCR 审查工具链，无业务代码规范，规则从简：

1. **改本包代码前必读** [.agents/skills/pr-review/SKILL.md](../../.agents/skills/pr-review/SKILL.md)：命令契约与 OCR 配置口径以该 Skill 为唯一真源。
2. **CLI 入口收敛**：对外命令只在 `src/cli.ts` 与 `src/commands/` 增删；根目录 `pnpm pr-review <command>` 是唯一调用方式。
3. **`reviews/` 是运行产物目录**：看板文件由 `pnpm pr-review pull` 生成，只读不手改；10 轮自动清理。
