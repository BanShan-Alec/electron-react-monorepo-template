---

name: pr-review
description: 项目专用的 Pull Request 生命周期与 OpenCodeReview (OCR) 自动化评审工作流。当用户提到“创建PR”、“提PR”、“开PR”、“拉取review/评审结果”、“触发review/复查”、“按review建议修改/修复问题”、“合并PR”、“查看PR状态”时，必须严格使用此 Skill 中定义的 `pnpm pr-review <command>` 系列命令，严禁使用散装脚本或自行猜测 gh 命令。
---

# PR Review 工作流（转发指针）

本文件只负责让这个 Skill 被检索到，**真源在同仓库的 [packages/pr-review/SKILL.md](../../../packages/pr-review/SKILL.md)**。

做任何 PR 操作前，先完整读取那个文件，严格按其中的命令契约与 SOP 执行。正文不在这里复制一份——同一份规范存两处，迟早只改一处。
