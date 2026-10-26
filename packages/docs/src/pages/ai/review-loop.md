# AI 评审闭环（Open-code-review）

> **TL;DR**：PR 新开或评论触发 AI 审查，产物拉成本地多轮看板，门禁全绿后一条命令合并。

## 要解决的坑

- AI 评审没有固定入口：PR 评论刷屏、历史意见没人收、代码修复后旧 review threads 挂着

## 本仓库的解法

→ 源码：[.github/workflows/open-code-review.yml](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.github/workflows/open-code-review.yml) · [packages/pr-review/src/cli.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/pr-review/src/cli.ts)

Actions 侧用 alibaba/open-code-review 挂 AI 审查（`@v1.13.3` 以发布 tag 钉版，粒度不同于 commit SHA 钉版）。触发点收窄：新开 / reopened / ready_for_review 的 PR 自动跑，后续 push 不自动触发；评论 `/review` 或 `/ocr` 手动补触发：

```yaml
on:
  pull_request:
    types: [opened, reopened, ready_for_review]
  issue_comment:
    types: [created]
# ...
if: >
  github.event_name == 'pull_request' ||
  (github.event.issue.pull_request &&
   (startsWith(github.event.comment.body, '/review') || startsWith(github.event.comment.body, '/ocr')))
```

### 两条入口先归一成同一份 PR 元信息

工作流第一步不是调 LLM，而是把两种事件归一成同一份 PR 元信息：`issue_comment` 只带评论对象，PR 的 base / head 要经 `pulls.get` 反查；`pull_request` 直接读 payload。后续 action 的三个入参因此不区分触发来源：

```yaml
- name: Resolve PR Info
  id: pr_info
  uses: actions/github-script@v7
  with:
    script: |
      if (context.eventName === 'issue_comment') {
        const { data: pr } = await github.rest.pulls.get({
          owner: context.repo.owner,
          repo: context.repo.repo,
          pull_number: context.issue.number,
        });
        core.setOutput('base_ref', pr.base.ref);
        core.setOutput('head_sha', pr.head.sha);
        core.setOutput('pr_number', pr.number);
      } else {
        core.setOutput('base_ref', context.payload.pull_request.base.ref);
        core.setOutput('head_sha', context.payload.pull_request.head.sha);
        core.setOutput('pr_number', context.payload.pull_request.number);
      }
```

同一 PR 上重复触发时，`concurrency` 组按 PR 号（评论触发时按 issue 号）收敛并 `cancel-in-progress: true`，旧运行直接取消——不会两个审查同时更新同一块 sticky 看板。权限给到 `contents: write`（`resolve_outdated` 要改 review thread 状态）、`pull-requests: write` 与 `issues: write`（发表 review 与 summary）。

### 评论治理与 LLM 配置

评论治理参数让 AI 意见可持续跟进而不是刷屏：

```yaml
checkpoint_range: 'true'     # 记录检查点，仅对最新 push 的 commits 进行增量审查
incremental: 'true'          # 行内评论不重复覆盖历史位置
sticky_summary: 'true'       # 置顶单一看板并原地更新，避免 PR 评论刷屏
resolve_outdated: 'true'     # 代码修复后，自动 resolve 对应的旧 review threads
route_severity_below: ''     # 关闭向 Summary 倾倒 Low 建议，避免把看板变成垃圾桶
```

`resolve_outdated` 需要 `contents: write` 权限（工作流顶部已注明缘由）。LLM 配置全走 secrets（`OCR_LLM_URL` / `OCR_LLM_TOKEN` / `OCR_LLM_MODEL`），`review_concurrency` 按 LLM 供应商限流压到 4。

除上面这组五个治理参数外，输入里还有四个开关：`language: 'Chinese'` 固定输出语言；`stream_progress: 'true'` 把审查进度实时打进 Actions 控制台，避免静默等待；`llm_use_anthropic: 'true'` 是因为 step_plan 端点走 anthropic messages 协议（`/v1/messages`），显式声明避免留空被歧义解析；`upload_artifacts: 'false'` 关掉 action 内部无保留期限制的上传，改由后续步骤托管。

```yaml
# step_plan 端点走 anthropic messages 协议（/v1/messages），显式声明避免留空被歧义解析
llm_use_anthropic: 'true'
# Step Fun 按 key 限并发（limit 5），OCR 多分组并行会 429 partial，压到 4 留余量
review_concurrency: '4'
```

Artifact 的名字是本地 CLI 的查询键：`ocr-review-result-<PR号>-<run_id>`。上传步骤 `if: always()`，即使审查步骤失败也会尝试留下 `ocr-result.json` 与 `ocr-stderr.log`；`if-no-files-found: ignore` 让「什么都没产出」不至于把上传步骤本身标成失败。

```yaml
- name: Upload Review Artifact (1 day retention)
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: ocr-review-result-${{ steps.pr_info.outputs.pr_number }}-${{ github.run_id }}
    path: |
      /tmp/ocr-result.json
      /tmp/ocr-stderr.log
    retention-days: 1
    if-no-files-found: ignore
```

### 限流（429）与 partial 结果

429 的成因写在 workflow 注释里：Step Fun 按 key 限并发 5，OCR 会把一次审查拆成多个分组并行跑，打满并发就出现 429，部分分组拿不到结论——即注释里说的 partial。工作流的处置只有一档：`review_concurrency: '4'`，主动留一个并发位的余量。

workflow 与代码都没有为 partial 再设兜底：

- `OcrResult` 只有 `summary` 与 `comments` 两个字段（`packages/pr-review/src/types.ts:13-20`），没有「部分完成」标志位；429 掉的分组不会出现在看板里，也不会被标注为遗漏
- 工作流没有重试步骤，也没有传任何重试相关输入；要补齐只能再触发一次审查（`pnpm pr-review trigger`）
- Artifact 上传是 `if: always()`：跑到一半被取消或失败的运行可能留下产物，也可能什么都不留；`getLatestRunInfo` 在 artifacts API 可用时用 `gh run list` 的 `conclusion === 'success'` 收窄候选（`src/core/ocr.ts:26-43`），只有一条成功运行都没有时才退回未过滤的 artifact 列表
- 拿到产物之后，下载失败、找不到 `ocr-result.json`、JSON 为空都会直接报错退出（`src/core/ocr.ts:201-228`），不会把失败静默当成空结果

实践上的处置顺序：先看本轮看板覆盖了哪些分组；429 掉的部分本轮不会补发，修完看板里已有的项后 `pnpm pr-review trigger` 开下一轮，新一轮按指纹比对，已修项进「上一轮已成功解决」。

### 本地 CLI：五个子命令

本地侧 pr-review CLI 把 PR 生命周期固化成五个子命令：`pull`（拉审查产物生成多轮看板）、`trigger`（触发增量审查）、`create`（建 PR 并按模板自动填充正文）、`status`、`merge`（等门禁全绿后 squash 合并）。`trigger` 核心就一行 gh 命令：

→ 源码：[packages/pr-review/src/commands/pr.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/pr-review/src/commands/pr.ts)

```ts
run('gh', ['pr', 'comment', prNum || currentBranch, '--body', '/review']);
```

`merge` 不靠肉眼盯 CI——从分支保护的 required checks 取清单轮询，全绿才执行 squash 合并并删远端分支：

```ts
const req = requiredChecks();
const isRequired = (name: string): boolean => (req === null ? true : req.includes(name));
// ...
run('gh', ['pr', 'merge', branch, '--squash', '--delete-branch']);
```

`cli.ts` 里还有两个别名：`review` → `trigger`、`pr` → `create`。`create` 的前置条件锁在 `preflight()` 里——工作区必须干净、当前分支不能是主干、分支上不能已有同名 PR；PR 标题取分支首个提交的 subject，正文按 `.github/PULL_REQUEST_TEMPLATE.md` 的二级标题填充「意图 / 改动 / 人工验证」三节。`merge` 未带 `--yes` 时要求终端输入 `y` 确认，随后按 15s 间隔、最多 40 次（10 分钟）轮询 required checks，失败或超时直接 `fail` 退出。

### 看板：从 artifact 到可勾选的修复清单

`pull` 把 Actions 里的审查 artifact 下载落盘成 markdown 看板（`packages/pr-review/reviews/pr-<PR号>-round-<轮次>.md`），带上一轮 diff 比对与当前 CI 状态，自动清理只留最近 10 轮——AI 意见因此可以在本地逐条勾掉，交给 Agent 修复闭环。

`pull` 的链路分四段：选轮次 → 下产物 → 继承上一轮 → 排版落盘。

**选轮次**：`getLatestRunInfo` 先按 artifact 名前缀 `ocr-review-result-<PR号>-` 找到属于该 PR 的所有 workflow run，再用 `gh run list --workflow=open-code-review.yml` 的成功记录过滤。轮次号不只靠「第几个 artifact」：sticky summary 里埋了一段 base64 的 `ocr-checkpoint`，解出其中的 run ID 后优先采信它——评论触发时 run 的 headBranch 可能显示为 main，靠分支名找会找错，测试专门覆盖了这个场景（`packages/pr-review/tests/unit/ocr.test.ts:37-73`）。轮次总数取「1 次开 PR 自动审查 + `/review` 评论数」与成功运行数的较大值。

```ts
const match = summaryComment.body.match(
  /<!-- ocr-checkpoint:(?:v[0-9]+|[a-zA-Z0-9._-]+)\s+([A-Za-z0-9+/=]+)\s*-->/,
);
if (match) {
  try {
    const decoded = JSON.parse(Buffer.from(match[1], 'base64').toString('utf-8'));
    const decodedRun =
      typeof decoded.run === 'number' ? String(decoded.run) : decoded.run;
    if (typeof decodedRun === 'string' && sortedIds.includes(decodedRun)) {
      targetId = decodedRun;
    }
  } catch {
    // fallback
  }
}
```

**下产物**：`fetchOcrResult` 用 `gh run download <runId>` 把 artifact 拉到 `reviews/.cache/<runId>`，递归找到 `ocr-result.json` 后解析；缓存按 runId 隔离，多轮之间不会互相覆盖。

```ts
  const downloadResult = spawnSync('gh', ['run', 'download', runId, '-D', runCacheDir], {
    encoding: 'utf-8',
  });
```

**继承上一轮**：`findLatestReviewFile` 取同一 PR 的上一轮看板 → `parseExistingDashboard` 解析出每条的忽略状态与「人工批注 / 修改要求」→ `computeFingerprint` 用「标准化路径 + 去掉行号后的说明前 160 字」做指纹。行号平移不会把同一条建议误判成新增或已解决。

```ts
  const cleanContent = content
    .replace(/L\d+/gi, '')
    .replace(/\b\d+\s*行/g, '')
    .replace(/[^\w\u4e00-\u9fa5]/g, '')
    .slice(0, 160);
  return `${normPath}::${cleanContent}`;
```

PR 有多轮运行但本地缺少早期看板时，`pull` 会先按 run ID 补齐历史轮次的看板，再排最新一轮；历史轮次不混入当前 CI 状态。

**排版**：看板顶部先放 `gh pr view --json statusCheckRollup` 拿到的 CI checks 表（按 lint → typecheck → test → e2e → Analyze / CodeQL → AI Code Review 排序），然后是「上一轮已成功解决」、处置规则、按 severity 分组的 Issue 卡片，最后是给 Agent 的修复指引。

```ts
  lines.push('### 📋 处置规则说明');
  lines.push(
    '- **🔴 高危 & 🟡 中度问题**：**默认全部采纳修复 (`[x]`)**。若某项属预期设计或需忽略，请取消勾选并在批注中注明。',
  );
  lines.push('- **🟢 低优常规建议**：**默认全部忽略 (`[ ]`)**。如需修复请手动勾选为 `[x]`。');
```

每张卡片的勾选框带机器可读标记：`<!-- action: fix -->`、`<!-- action: ignore -->`、`<!-- action: manual-fix -->`；高危/中度默认 `[x]` 采纳修复，低优默认 `[ ]` 忽略，忽略状态与人工批注跨轮继承。卡片还带两个导航链接：GitHub PR 行内讨论（按 `path:line` 匹配）与该行在 head SHA 上的源码位置。

**落盘与清理**：文件名按 `pr-<PR号>-round-<轮次>.md`；没有 PR 时退化为 `branch-<分支名>-round-<轮次>.md`（分支名里的非字母数字字符替换成 `_`）。写盘后 `cleanOldReviewFiles` 按 mtime 只留最近 10 个 `.md`，临时下载缓存在 `finally` 里整个删掉。

### 自带的测试配置

包内自带 Vitest 配置（`packages/pr-review/vitest.config.ts`：node 环境、`tests/unit/**/*.test.ts`），根目录 `pnpm test:pr-review` 单独运行；测试覆盖轮次计算、产物缓存隔离、看板解析与指纹继承，本文不展开。

## 怎么抄

- OpenCodeReview 挂 Actions，本地 pr-review CLI 固化 create / trigger / merge / pull

按本仓库代码，落地顺序是：

1. **挂工作流**：复制 `.github/workflows/open-code-review.yml` 的触发面（`opened` / `reopened` / `ready_for_review` 与 `/review`、`/ocr` 评论），LLM 三件套进 secrets，`review_concurrency` 按供应商限流留余量
2. **配权限与产物**：`contents: write` 给 `resolve_outdated`，`pull-requests: write` / `issues: write` 发表 review 与 summary；artifact 命名保持 `ocr-review-result-<PR号>-<run_id>`，本地 CLI 按这个前缀查询
3. **接本地 CLI**：根 `package.json` 用 `pnpm --filter @app/pr-review run cli` 暴露 `pnpm pr-review <command>`；`create` / `trigger` / `pull` / `status` / `merge` 五个入口全部收敛在 `src/cli.ts`
4. **配分支保护**：required checks 清单就是 `merge` 轮询的依据，新 job 不加进去就永远等不到
5. **日常闭环**：`create` → `trigger` → 2~3 分钟后 `pull` → 在看板勾选或批注 → Agent 按勾选项修 → 再 `trigger`

注意点：

- CI 新增 job 后记得同步到分支保护的 required checks，否则 `pr-review merge` 的等待逻辑里不会包含它
- OpenCodeReview 的触发窗口只有 PR 新开 / ready 与 `/review`、`/ocr` 评论，后续 push 不自动审查——改完代码记得手动补一次 trigger
