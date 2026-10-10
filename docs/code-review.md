# AI 代码审查 (OpenCodeReview) 作业指南

> 本文档规范了本仓库在 Pull Request (PR) 流程中集成 **OpenCodeReview (OCR)** 的运作机制、触发方式、噪声治理策略以及与各类 AI 编程 Agent 协同修复的最佳实践。

---

## 🎯 1. 核心机制概览

本仓库接入了基于大语言模型的代码审查工具 `alibaba/open-code-review`，并进行了深度定制优化：

```mermaid
flowchart TD
    A["提交 Pull Request (Opened)"] -->|"自动触发首次 Review"| B["AI 审查执行"]
    C["后续代码更新 (Push)"] -->|"不自动触发 (防噪音/省 Token)"| D["开发者本地多轮自测"]
    D -->|"在 PR 评论回复 /review"| B
    B --> E["📊 更新置顶 Summary 看板<br/>(按 Critical/High/Medium 分级)"]
    B --> F["💬 发送高危 Inline 评论<br/>(低优先级折叠收拢)"]
    B --> G["✨ 自动 Resolve 已修复的旧 Thread<br/>(新 Commit 修复后自动关闭)"]
```

### 1.1 真增量审查 (`checkpoint_range: true`)
- **初次开 PR**：从 `merge-base` 到最新 commit 进行全量审查。
- **后续复查**：Bot 在置顶看板中记录上次审查的 commit 检查点。后续审查**仅对 `<checkpoint>..<new head>` 之间的纯增量提交进行扫描**，避免重复审查旧代码。
- **不重复评论 (`incremental: true`)**：即使增量范围有交集，相同代码行也不会重复发送雷同评论。

### 1.2 置顶动态看板 (`sticky_summary: true`)
- Bot 首次运行会在 PR 讨论区发布一条带有隐式签名（`<!-- ocr-summary -->`）的看板。
- 后续轮次的审查结果将通过 GitHub API **直接原地更新（PATCH）这一条看板**，避免反复发布主评论造成 PR 刷屏。

### 1.3 噪声治理与折叠 (`route_severity_below: low`)
- **高危问题（Critical / High / Medium）**：直接在代码差异行内生成 Inline Comment，便于就地查阅。
- **次要建议（Low / Style / Lint）**：自动收拢至置顶 Summary 看板的折叠区域 `<details>` 中，行内评论噪点减少 70% 以上。

### 1.4 自动关闭过时评论 (`resolve_outdated: true`)
- 当你在后续 commit 中修改了原来报错的代码行后，GitHub 会自动将其标记为 `isOutdated`。
- Bot 在下一轮审查确认该位置没有再次报错后，会自动调用 GraphQL API 将该 Review Thread 标记为 **Resolved**。
- **保护机制**：有人类参与讨论的 Thread、已手动关闭的 Thread、或者新代码依然存在问题的 Thread，**绝对不自动关闭**。

---

## 🚀 2. 触发方式与交互指令

| 操作场景 | 触发方式 | 说明 |
| :--- | :--- | :--- |
| **新建 PR / Reopen** | ⚡ **自动触发** | PR 创建或从 Draft 转为 Ready 时自动启动首轮全面检查 |
| **后续提交代码 (Push)** | ⏸️ **静默不触发** | 允许开发者多次 commit 与 push，避免 CI 反复排队和 Token 浪费 |
| **手动请求复查 (CLI 一键)** | ⌨️ **本地命令 `pnpm review:trigger`** | 自动识别当前分支的 PR 并发送 `/review` 评论，免去切换浏览器 |
| **手动请求复查 (网页端)** | 💬 **PR 评论 `/review` 或 `/ocr`** | 增量审查新增的 commit，刷新置顶看板，并自动 resolve 已修复的问题 |

> 💡 **小贴士**：如果进行了大面积文件重构，希望跳过 checkpoint 执行从头到尾的全量扫描，可在工作流手动调度中传入 `full_review: true`。

---

## 🤖 3. 与 AI Agent 协同修复的最佳实践

为彻底消除 GitHub PR 讨论区被 Low 级别评论刷屏的痛点，推荐采用**“本地一键拉取高优看板 ➔ 勾选/批注裁决 ➔ AI Agent 闭环修复”**的极简链路：

```mermaid
sequenceDiagram
    autonumber
    actor Dev as 开发者
    participant Local as 本地终端
    participant File as .github/pr-review-tmp/pr-XX-review.md
    participant Agent as 本地 AI Agent
    participant GH as GitHub (CI)

    Local->>GH: 运行 pnpm review:pull (下载并过滤最新 Review 产物)
    Local->>File: 自动生成高优看板 (聚焦 High/Medium，Low 压缩为一句话)
    Dev->>File: 打开 Markdown 快速打勾 [x] 并留下一两句批注
    Dev->>Agent: 发送指令："根据 .github/pr-review-tmp/pr-XX-review.md 修复勾选的 Issue"
    Agent->>Agent: 本地读源码、执行修复并跑通本地测试
    Agent->>Local: 修复完成并规范提交
    Dev->>GH: git push 并在 PR 评论发送 "/review"
    GH->>GH: 触发增量 Review，自动 Resolve 已修复的讨论！
```

### 协同步骤：
1. **本地一键拉取高优看板**：
   ```bash
   pnpm review:pull
   ```
   - 自动匹配当前分支关联 PR 的最新已完成 CI Review 产物（智能兼容 PR 触发与评论触发记录）；
   - 依据当前 PR 编号动态命名产物为 `.github/pr-review-tmp/pr-<PR编号>-review.md`（已加入 `.gitignore`）；
   - 高中危默认勾选采纳（`- [x]`），低优常规建议完整保留但默认忽略（`- [ ]`，支持手动打勾修复），全面内嵌 GitHub 讨论与源码直达链接。

2. **快速裁决与人工批注**：
   - 在编辑器中打开 `.github/pr-review-tmp/pr-<PR编号>-review.md`；
   - **高危 / 中危**：认可的缺陷保持默认勾选；若某项属预期设计或需忽略，请取消勾选或勾选忽略，并在批注中注明原因；
   - **低优常规**：默认忽略；若有想要顺手修复的条目，手动勾选为 `[x]`；
   - 如有定制化改法，直接在每项下方的 `人工批注 / 修改要求` 输入自然语言指令。

3. **委托 AI Agent 闭环修复**：
   - 直接在对话框向 AI Agent 发送看板中附带的提示词：  
     > “请根据 `.github/pr-review-tmp/pr-<PR编号>-review.md` 执行代码修复：对标记修复的项执行修复，勾选忽略或留有批注的遵照批注处置，完成后运行本地测试。”
   - AI Agent 会精准定位源码行号、严格遵照你的勾选与批注执行修改，并自动运行 `pnpm lint`、`pnpm typecheck`、`pnpm test` 和 `pnpm test:e2e` 验证。

4. **一键提交并触发增量复查**：
   ```bash
   # 规范提交并推送到远端特性分支
   git push origin <branch>

   # 本地一键向 PR 发送 /review 请求（免开浏览器网页）
   pnpm review:trigger
   ```
   - 审查机器人将进行增量扫描，并在置顶看板中更新第二轮结果，同时将已修复代码行对应的历史评论自动标记为 **Resolved**；
   - 云端执行完成后，再次运行 `pnpm review:pull` 即可拉取第二轮看板比对收敛情况。

---

## ⚙️ 4. 工作流配置与密钥说明

审查工作流定义于 [`.github/workflows/open-code-review.yml`](file:///h:/electron-app-temp5/.github/workflows/open-code-review.yml)。

### 必需权限
```yaml
permissions:
  contents: write       # 必需：修改 Review Thread 状态执行 resolveReviewThread
  pull-requests: write  # 必需：发表行内评论与 Summary
  issues: write         # 必需：监听并响应 PR 评论
```

### 必需 Repository Secrets
- `OCR_LLM_URL`：兼容 OpenAI 规范的 API 端点地址。
- `OCR_LLM_TOKEN`：API 访问密钥。
- `OCR_LLM_MODEL`：模型名称（如 `gpt-4o`、`claude-3-7-sonnet`、`qwen-max`）。

---

## 💡 5. 多轮复查常见疑问与应对策略

### Q1: 为什么执行第二轮复查后，依然会列出较多建议？
1. **人类决定忽略的设计**：OpenCodeReview 作为基于代码上下文扫描的 AI 机器人，并不具备人类团队内部业务讨论的先验记忆。因此在初次审查被开发者标记为“忽略”的项（如合理的宽泛环境判定或架构权衡），后续全量看板扫描仍可能会提及。此时依然**遵照看板规则：被开发者批注忽略的项绝不误改，维持原有意志**。
2. **已修复问题确已移出**：每次复查时，上一轮已修复的关键问题（如定时器清理错误、硬编码版本号、Changelog 遮挡 bug 等）会自动被移除或关闭 Thread，看板聚焦于增量变化。
3. **新引入工具的质量建议**：若在修复过程中引入了新的脚本工具（例如 `scripts/review-pull.ts`），Review 机器人也会对新增代码提供代码健壮性、防目录穿越等质量扫描，挑选高价值项顺手加固即可。
