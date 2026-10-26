# AI 友好代码约定（引用式）

## 要解决的坑

- 代码风格靠口口相传：同一个人隔一周写的组件、不同 AI 写的组件，分区顺序各异，diff 里一半是搬家
- 提交信息随手写：`fix bug`、`update`、拼音首字母，changelog 生成器与后来者都读不出意图
- 规则只写在长文里：AI 读得到「要统一」，读不到「怎样算通过」，每次都要重新猜
- 约定一旦不可判定，就只能等 Review 阶段返工

## 本仓库的解法

### 1. 组件固定分区：把「怎么写」变成可复制的顺序

完整模板与分区清单见 [React 组件编写规范（代码分区与 hooks 约定）](/architecture/react-conventions)，这里只解释它为什么对 AI 有效。

规则本身很短：每个组件文件用同一套分区注释、按同一顺序排列，空分区也保留。对无状态的生成者来说，这是一个稳定的骨架：每次新建组件都从同一个位置开始写，新逻辑只会落在它该在的段里。结果是人和 AI 产出的组件在结构上同构，diff 里只剩语义改动，评审能直接看「改了什么」而不是「搬了哪几段」。

规则真源在 `packages/renderer/AGENTS.md` §5「组件书写约定」，模板本体是一组件一文件夹下的 `index.tsx`；两份互为印证，文档站不复制模板正文。

### 2. 中文提交规范：把「写清楚」变成硬校验

完整的 commit 格式、type 枚举与 scope 约定见 [提交信息规范（commitlint）](/engineering/commit-convention)。这里只保留与 AI 相关的一层：`subject` 必须包含简体中文，这是 `.config/commitlint.config.ts` 里的 `subject-chinese` 自定义插件规则，用 `/[\u4e00-\u9fa5]/` 判定，命中即 error；husky 的 `commit-msg` 钩子执行 commitlint，不合规的提交进不了历史。

为什么值得为 AI 单独强调：提交信息是唯一会长期留存、又被机器消费的意图记录。`changelogen` 按 conventional commit 的 type 分节生成 changelog（`.config/changelog.config.ts` 把 feat / fix / perf / refactor 等映射到不同章节与 semver），`pnpm pr-review create` 则直接取分支首个提交的 subject 当 PR 标题——AI 写对一条 commit，版本记录与 PR 标题都不需要二次加工。

### 3. 可判定：同构来自「机器能说不」

约定分三层落地，每一层都能给出 pass/fail：

- **提交钩子**：`.husky/pre-commit` 执行 `lint-staged`，对暂存文件跑 `biome check --write --config-path=.config`，格式化或 Lint 失败即中断提交
- **Lint**：Biome 的 `noBarrelFile` / `noReExportAll` 为 error，`noRestrictedImports` 禁止直连 ahooks `useRequest`（规则细节见 [代码规范与风格（Biome）](/engineering/code-style)）
- **CI**：`typecheck` / `lint` / `test` / `e2e` / `docs` 五个并行 job，均为分支保护的 required checks

对 AI 来说，可判定的意义是可以在提交前自检：跑一遍 `pnpm lint` / `pnpm typecheck` / `pnpm test`，规则通过与否不依赖评审者的口味。反过来，无法判定的「风格偏好」不要写成红线——AI 只能猜，猜错就是返工。

### 4. 引用式：规则只留一个真源

这一页不复制分区模板与 commit 格式，只解释动机并给出链接。原因和规则本身一致：同一份规则维护两处，改一处漏一处；对 AI 而言，上下文里多一份过时副本，比没有更糟。规则真源在 `packages/renderer/AGENTS.md`、`.config/commitlint.config.ts` 与 `.config/biome.json`，文档站只做索引。

AI 协作者约定的分层与红线另见 [AI 协作者约定（AGENTS.md 分层与红线）](/ai/collaboration-convention)；AI 评审如何把看板变成可勾选的修复清单，见 [AI 评审闭环（OpenCodeReview + pr-review）](/ai/review-loop)。

## 怎么抄

以「让 AI 与人类产出同构代码」为目标，四步：

1. **先固化结构模板**：把组件分区写成注释骨架，按 [React 组件编写规范（代码分区与 hooks 约定）](/architecture/react-conventions) 落地
2. **再把提交格式交给工具**：commitlint + husky，按 [提交信息规范（commitlint）](/engineering/commit-convention) 配置
3. **把每条约定改写成可判定句子**：能挂 lint 的挂 lint，能进门禁的进门禁，挂不上的降级为文档说明
4. **规则写进仓库、文档只引用**：AGENTS.md 与配置文件是真源，文档站不复制正文

注意点：

- 分区注释即使某段为空也保留，AI 才会在同一位置继续写
- 提交说明必须含简体中文是 commitlint 的 error 规则，不是风格建议
- 无法判定的偏好不要写成红线；红线越多越不可执行
- 引用不复制：同一条规则只维护一处，改的时候只改真源
