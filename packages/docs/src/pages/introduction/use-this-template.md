---

title: 使用此模板（Use-this-template）
description: 把模板转为自己项目的八组原子任务，提供引导 Agent 执行的结构化 Prompt，每组给出目标与可复制的完成判据。
---

# 使用此模板（Use-this-template）

> **TL;DR**：通过模板创建独立仓库之后、写第一行业务之前，按 §2 八组任务完成「转为己有」。每组只给目标与判据，建议先用文首 Prompt 委派给 AI 协作者按序推进，人再对照判据逐项验收。

## 1. 委托 Agent 执行 Prompt 与前置条件

### 1.1 给 Agent 的委托执行 Prompt

你可以直接复制以下 Prompt 发送给你的 AI 编程助手（如 Cursor、Claude Code、GitHub Copilot 或 Antigravity）：

```markdown
请阅读项目文档 `packages/docs/src/pages/introduction/use-this-template.md`（或参考文档站「使用此模板」页面）。
按照文档 §2 中的八组原子任务依次执行，将当前模板改造成我自己的桌面端项目。

执行要求：
1. 任务 1 请遵循命名规约与推导规则（若我未单独提供，请主动向我确认应用英文名、中文/展示名与 App ID，或按规则安全推导）；
2. 严格以每个任务给出的“判据”作为完成标准，逐项验证通过后再进入下一任务；
3. 全部任务完成后，运行任务 8 的收尾门禁命令，确保没有模板坐标残留且全仓检查全绿。
```

### 1.2 执行时机与前置条件

- **何时执行**：建议在 GitHub 点击「Use this template」创建不带模板提交历史的独立仓库之后、编写第一行业务代码之前执行；官方操作步骤见 [Creating a repository from a template](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template)（读它能确认如何从模板生成全新提交历史而非带上游记录的 Fork）。
- **边界声明**：本页负责将模板初始化为自有产品仓库的八组清理与改名任务；不负责本地环境启动（见 [快速上手](/introduction/getting-started)）或各字段在运行时的消费细节（见 [配置项归属](/dx/configuration-map)），演示业务域随实际需求自行删改。
- **执行方式**：使用上方 Prompt 委托 AI 协作者逐任务执行，或人工照做；每个任务均有命令或人工验收判据，逐条通过后再进入下一步。

## 2. 核心机制

### 任务 1：身份与仓库坐标改名

全仓身份由根 `package.json` 单一真源解析（[build/lib/app-identity.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/build/lib/app-identity.ts) 消费），更新以下核心字段即可贯通打包产物名、主进程发布源与窗口标题（注意 `author.url` 为构建期必填项，缺失会在 `requireDisplayField` 直接中断构建）：

→ 源码：[package.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/package.json)（节选）
```jsonc
{
  "name": "electron-react-monorepo-template",
  "productName": "Electron React Template",
  "appId": "com.template.electron-react-monorepo",
  "description": "Type-safe Electron monorepo template powered by Vite, React and ContextBridge IPC",
  "license": "Unlicense",
  "author": {
    "name": "BanShan-Alec",
    "email": "627649674@qq.com",
    "url": "https://github.com/BanShan-Alec"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/BanShan-Alec/electron-react-monorepo-template.git"
  }
}
```

#### 字段规约与推导规则（供 Agent / 人工参考）

若未显式指定字段值，执行者应遵循以下确定性规则：
- **`name`**：必须满足纯小写正则 `/^[a-z0-9-_]+$/`（严禁空格、大写与 `@/` 等特殊符号，否则会被 `pnpm verify:prebuild` 拦截）；默认由仓库根目录名推导。
- **`productName`**：桌面窗口标题、安装器与快捷方式展示名；默认由 `name` 转为 Title Case。
- **`appId`**：应用全局唯一标识（Windows AUMID、macOS Bundle Identifier）；推荐反向域名 `com.<org-or-author>.<clean-name>`。
- **`author` / `repository` / `license`**：更新为项目拥有者的名称、个人或组织主页 `author.url`、真实 GitHub 仓库地址与协议类型。

- **判据**：`pnpm verify:prebuild` 与 `pnpm build:unpack` 通过（缺失 `author.url` 等必填展示字段会在构建期报错）；`productName` 与 `appId` 对外发版后不可再改。

### 任务 2：品牌资源替换

替换安装器 / 窗口图标、界面 logo 家族与 favicon，保持安装器、Header、首屏三处视觉一致。

- **判据**：`pnpm build:unpack` 产物窗口、任务栏、安装器图标正确，界面 logo 无变形。

### 任务 3：剥离文档站

`packages/docs` 是本模板的自述文档站：与产品无关时可删掉整包及仓库内引用。需注意：根 `tsconfig.json`、`pnpm docs:*` 脚本、CI 的 `docs` job 等引用删漏后容易暴露，但 [packages/shared/src/constants/docs.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/constants/docs.ts) 中的 `PROJECT_DOCS_URL` 是纯字符串常量，**删包后 `pnpm typecheck` 不会因此报错**；此外还有以下文档与工作流文件不会触发编译报错，必须人工核对清理：

- 根 `AGENTS.md`：`@app/docs` 包索引行与「文档站内容变动」门禁行；
- `CONTRIBUTING.md`：涉及文档站或 `docs:build` 的说明条目；
- `.github/CICD.md`：`docs` check 条目与「五个 check」计数（删后改为四个）；
- `.github/workflows/docs-deploy.yml`：整文件删除（不再向 GitHub Pages 发布模板文档站）；
- 代码注释与常量中的 `@app/docs` 或 `PROJECT_DOCS_URL`（如 `scripts/dev.ts`、`packages/shared/src/constants/docs.ts`）。

删完在 GitHub 分支保护里移除 `docs` required check——否则之后每个 PR 都会停在 Pending。

- **判据**：`pnpm docs:build` 报命令不存在为预期；`pnpm typecheck && pnpm lint && pnpm test` 绿；任务 8 的 grep 零命中。

### 任务 4：pr-review 工具链（默认保留）

默认保留、零改码：`create` / `status` / `merge` 依赖 `gh` 登录即可用；要启用 AI 自动评审，在仓库 Settings → Secrets and variables → Actions 配 `OCR_LLM_URL` / `OCR_LLM_TOKEN` / `OCR_LLM_MODEL` 三枚密钥。不打算用就删 `.github/workflows/open-code-review.yml` 一个文件（留着不配 secrets，每个 PR 都会挂一个红叉）。

- **注意**：评审只在 PR opened / reopened / ready_for_review 时触发，后续 push 不会自动复查，需 `pnpm pr-review trigger`；`AI Code Review` 保持非 required。
- **判据**：新开一个 PR 后 `AI Code Review` 正常跑完（或 workflow 已删），`pnpm pr-review status` 能列出 PR 与 checks。

### 任务 5：重写根 README

模板 README 讲的是模板自己（徽章、文档站入口、解法地图、演示截图）：整体重写为你的产品 README——它是什么、怎么跑、怎么贡献。

- **判据**：人工验收，重写后不再描述模板自身。

### 任务 6：版本史清零

删 `CHANGELOG.md`，删除全部 `v*` tag（本地与远端）与 GitHub Releases，按 [发版流水线（Changelogen）](/delivery/release-pipeline) 从首个版本重新起步。

- **判据**：新 tag 推送后 GitHub Release 正常生成，三平台产物齐全。

### 任务 7：依赖与配置放置

派生项目后续引入新工具（数据库 CLI、构建插件、Lint 插件等）时，遵循根 [CONTRIBUTING.md](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/CONTRIBUTING.md) §三「配置与依赖归属」：配置跟着归属包走，跨包工具进 `.config/` 与根 `devDependencies`，根目录只留机制强制的固定项。

- **判据**：根目录不存在清单外的 `*.config.*` 文件；新增依赖出现在其归属包的 `package.json`（运行时加载 → `dependencies`，刻意内联 → `devDependencies`）。

### 任务 8：收尾门禁

八组任务做完后跑一次总验收，拦截跨任务遗漏——删包后 lockfile 未重生成、被删对象的外部引用与残留的模板坐标：

```bash
pnpm install   # 重生成 lockfile；CI 用 --frozen-lockfile
grep -rin "banshan-alec\|electron-react-monorepo-template\|packages/docs\|@app/docs\|docs:build\|docs:dev\|docs check" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git .
```

- **判据**：上面 grep 零命中；`pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e && pnpm verify:prebuild` 全绿；推送后 CI 全绿。

## 3. 桌面端避坑注意事项

- **`productName` 决定 `userData` 路径**：改动后旧版本的持久化数据与日志不会自动迁移，用户会表现为「设置全丢」。确需变更时在主进程显式 `app.setPath('userData', ...)`，详见 [配置项归属](/dx/configuration-map)。
