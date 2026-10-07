# feature 一律经 PR 合入 main 与 squash-only 锁定

Status: accepted（2026-10-07）

仓库早有成文政策「只允许 squash merge」（CICD.md「合并」），但分支保护从未配置，GitHub 三个合并按钮全部可用——PR #11 实际以 merge commit 落入 `main`，政策与事实分叉。本裁决：**feature 分支一律经 PR 合入 `main`，分支保护锁死两件事（三个 required check 全绿 + 仅允许 squash merge、拒绝直接 push），并把流程封装为 `pnpm pr / pr:merge / pr:status` 三个 gh cli 命令**。约束的持久性靠「走 PR 比绕过它更省事」保证，不靠记忆和自觉。

选 squash 的锚点是回滚与发版：

- 单提交 PR 的回滚是普通 `git revert`，干净无陷阱；merge commit 的回滚要 `revert -m 1`，且踩「revert 后重新合并成空 diff」的经典陷阱——分支历史经合并节点成为 main 祖先，GitHub 判定已合并；
- changelogen 从提交生成 CHANGELOG，squash 保证「一个 PR 恰好一行」；merge 方式下一个 PR 会碎成多条日志并混入 merge 节点噪音；
- `git bisect` 在线性历史上每一步都是可构建的 feature 粒度，不会停在分支内的 WIP 提交上。

单人仓库无评审需求（required_approving_review_count = 0），PR 的价值在门禁与历史粒度，不在人审。

## Considered Options

- **A. 维持现状：政策成文但不锁**：GitHub 端随时可以 merge commit 或直推 main，政策靠自觉——已在 #11 上失效，否决；
- **B. PR + squash-only + 分支保护锁死（选定）**：main 线性、回滚干净、changelog 按 feature 粒度；代价是 bootstrap 与紧急场景也要走 PR——hotfix 本就设计为走同一门禁，直推 main 被视为违规而非便利；
- **C. PR + merge commit**：保留分支内中间提交，但 main 网状、回滚踩 `revert -m 1` 陷阱、changelog 碎——否决；
- **D. package.json 直连 gh 命令（零包装）**：无前置检查与标题/模板自动化，每次手敲参数，走 PR 的摩擦反而变大——否决，取 `scripts/pr.ts` 封装。

## Consequences

- `scripts/pr.ts`（`pnpm pr / pr:merge / pr:status`）成为开 PR 与合并的标准入口；PR 标题自动取分支首个提交 subject——**分支首个提交的措辞升级为「PR 标题」语义**，需维持 conventional 格式（无机器校验，靠自觉）；
- 分支保护以 `gh api` 一次性配置：required status checks（typecheck / lint / e2e）、仅允许 squash、require PR（0 评审即可合并）、`enforce_admins` 使 owner 同样受约束——直推 main 从「习惯」变为「被拒」；
- 本政策的例外仅一处：PR 工作流工具自身（本 ADR 与 `scripts/pr.ts`）以 chore PR 形式完成首次合入，此后一切改动回归 PR；
- 合并后的分支清理由 `pr:merge --delete-branch`（远端）与 CICD.md「合并」的收尾命令（本地/worktree）承接，避免 #11 式远端残留。
