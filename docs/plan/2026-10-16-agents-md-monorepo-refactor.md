# AGENTS.md Monorepo 分层重构计划（as-built）

- 日期：2026-10-18
- 状态：已执行 · 分支 `docs/agents-md-monorepo-refactor`（基于 main `c6162f9`，含 #37 logger 与 #38 OTA）
- 背景：参考掘金《一份 AGENTS.md，让 AI 代码规范率从 60% 飙升到 95%》六章框架，按本仓 monorepo 形态设计文档分层

## 0. 基线变更记录（相对初版计划）

grilling 定稿时仓库在 `docs/template-optimization`（cbb6a29）线上；执行前主线已推进——logger 工作以 #37、OTA/Sentry 工作以 #38 相继合入 main，且本计划初版被顺手并入 #38 带上了 main。旧线上的 `AGENT.md`（69 行）与 `docs/1-5` 在新主线不存在，据此调整：

1. **「更名 AGENT.md → AGENTS.md」作废**：新主线从未有过该文件，改为从零创建 `AGENTS.md`（标准复数名，ZCode 工作区指令文件名）。
2. **路由表目标更换**：`docs/1-5` 不存在，改为现役专题文档集（adr/、i18n/、code-review.md、dependency-rules.md 等 17 篇，含 #38 新增的打包与 OTA 两篇）。
3. **「扩展 §八 文档同步纪律」作废**：该节只在旧线存在，本线 CONTRIBUTING 为 213 行无 §八，不新增章节（超出批准范围）。
4. **包规则内容按源码实况重写**：包 README 与源码存在既存失真（见 §6），新 AGENTS.md 以源码为准，失真随拆分自然修复。

## 1. 已定决策（grilling 结论，未变）

1. 根 `AGENTS.md` = 纯目录：3 条全局红线 + 包索引 + 两级任务路由表 + 命令 + 指针；mermaid 决策树转表格。
2. 包规则从 README 全量拆出进 `packages/*/AGENTS.md`（目录树 / 铁律 / 严禁 / SOP / 命名 / 门禁）；README 退居人类向 overview + 一行 AI 指针。
3. 视觉规范独立文件 `packages/renderer/docs/DESIGN.md`：纪律+指针型（约 25 行），不复制色板（颜色真源在 tokens.css）。
4. `.agents/rules/logging-specification.md` 保留（globs 横切规则），根文件加一行显式索引补 ZCode 侧可见性。
5. CONTRIBUTING 收缩为全局人类规范：包级规则（manual-only）下沉，重复处改指针。
6. Never 规则行内出处（日期+事由；挖不出故事的标迁移来源）。
7. 验收 = 静态清单（随交付可勾选）+ 用户一次性行为抽检。
8. 重复政策：零重复只针对规则断言；命令字符串允许重复。

## 2. 目标结构（实际落点）

```
AGENTS.md                               # 新建：目录 + 3 条全局红线 + 路由表（60 行）
packages/main/AGENTS.md                 # 新建：树+依赖表+铁律5+严禁4+SOP+门禁
packages/preload/AGENTS.md              # 新建：树+编写规则5
packages/renderer/AGENTS.md             # 新建：树+Feature规范6+sections铁律5+请求层+组件约定+i18n+门禁
packages/renderer/docs/DESIGN.md        # 新建：视觉纪律与指针（~25 行）
packages/shared/AGENTS.md               # 新建：树+设计原则5+命名表+SOP
packages/pr-review/AGENTS.md            # 新建：薄件 3 条
packages/{main,preload,renderer,shared}/README.md   # 瘦身：定位+why+跨包关联+AI 指针
CONTRIBUTING.md                         # §一.3 加指针、§一.4 压缩为指针、文件头加 AI 入口
README.md                               # 架构导航表后加 AI 入口指针一行
.agents/rules/logging-specification.md  # 不动
docs/plan/2026-10-16-agents-md-monorepo-refactor.md  # 本文件（as-built 改版）
```

## 3. 逐包拆分映射（对当前 README + 源码实况）

### main（README 132 行 → 约 20 行）

| 现章节 | 去向 | 源码实况修正 |
| --- | --- | --- |
| §1 目录职责总览 | → AGENTS.md | 树补回 `telemetry/`（tracer / ipc-tracer / window-tracer，源码实存） |
| §2 核心架构铁律 5 条 | → AGENTS.md | 原文迁移 |
| §3 严禁清单 | → AGENTS.md | 「禁私自建桶文件」删除（全局红线 2 已覆盖，避免双真源）；「禁反向依赖 Renderer」补回合法例外（index.ts 装配期 `require.resolve('@app/renderer')` 取 HTML 产物，源码 index.ts:86-92）；补回「禁遗漏生产依赖 external 对齐」（CI `verify:deps` 实装） |
| §4 SOP | → AGENTS.md | 裸 `ipcMain.handle` 改为 `handleTraced`（全部控制器实际走 handleTraced，第二形参为解包后数据） |
| §5 跨包关联 | 留 README | — |

### renderer（README 199 行 → 约 75 行）

| 现章节 | 去向 | 源码实况修正 |
| --- | --- | --- |
| §目录总览 | → AGENTS.md | 树补 `startup/`、包根 `plugins/startup-shell.ts`、styles 四个文件；features 列全 11 个域 |
| §分层依据 | → AGENTS.md（规则句） | 依赖方向补回 dashboard 唯一例外 |
| §Feature 规范 6 条 + sections 铁律 5 条 | → AGENTS.md | 原文迁移 |
| §请求层 + 日志纪律 | → AGENTS.md | 并入 CONTRIBUTING §一.4 manual-only 浓缩 |
| §组件书写约定 | → AGENTS.md | 原文迁移 |
| §i18n | → AGENTS.md（规则）+ README 保留文档指针 | — |
| §已知取舍 | 留 README | 「暂不引入路由」已过时（wouter 随 #32 落地）→ 改为「已接入 wouter」；「7 个域」→ 11 个域 |
| §跨包关联 | 留 README | — |

### shared（README 159 行 → 约 30 行）

| 现章节 | 去向 | 源码实况修正 |
| --- | --- | --- |
| §1 目录架构 | → AGENTS.md | 树补 `utils/`（env-packer / w3c-trace-context）、`types/logger.ts`、`startup.ts`、`telemetry.ts`、`updater.ts`、`schemas/updater.ts`、`shell.ts` |
| §2 核心设计原则 2.1-2.5 | → AGENTS.md | §2.5 渲染门面表述修正：`packages/renderer/src/lib/env.ts` 已不存在，实际经 `window.__APP_ENV__` 消费（类型在 renderer/src/env.d.ts） |
| §3 命名规范表 | → AGENTS.md | 原文迁移 |
| §4 SOP | → AGENTS.md | 原文迁移 |
| §5 跨包关联 | 留 README | — |

### preload（README 45 行 → 约 35 行）

| 现章节 | 去向 | 源码实况修正 |
| --- | --- | --- |
| §2 目录与实现规范 | → AGENTS.md | 树补 `logger.ts`（渲染 logger 桥）与 `telemetry/ipc-tracer.ts`（源码实存，README 原文「仅单一主入口」已过时） |
| §编写规则 3 条 | → AGENTS.md | 补第 4 条「必须经 invokeTraced 透传追踪」（源码全部 invoke 实走 invokeTraced） |
| §1 核心定位 | 留 README | — |

### pr-review（README 不动）

工具包无代码规范，新建薄件 `AGENTS.md` 3 条：改包先读 `.agents/skills/pr-review/SKILL.md`；CLI 入口收敛 `src/cli.ts`；`reviews/` 为运行产物只读不手改。

## 4. CONTRIBUTING.md 变更

- 文件头（导语后）加 AI 入口指针一行。
- §一.3 桶文件禁令：文末加指针（包内形态见各包 AGENTS.md）。
- §一.4 manual-only：压缩为 3 行指针，规则本体进 renderer/AGENTS.md「请求层」。
- 本线无 §八，不新增章节；文档同步纪律仅在旧线存在，不在本计划范围。

## 5. renderer/docs/DESIGN.md 大纲（约 25 行）

四条纪律：禁硬编码颜色/间距/字体（一律 `var(--color-*)` 或 Tailwind 主题类）；改品牌 = 改 token 不改组件（tokens.css 唯一定义 → tailwind.config.ts 映射 → antd-theme.ts 镜像）；antd 样式只经 antd-theme.ts / ConfigProvider；深浅色由 `darkMode: 'class'` + `documentElement.dataset.theme` 驱动。指针：当前品牌色以 tokens.css 为唯一真源不复制色板；品牌定制入口 docs/template-customization-guide.md。

## 6. 顺带发现（范围外，建议另行处理）

执行中确认的既存失真（已被本计划的新文件修复的除外）：
- **CONTRIBUTING §二.4 命令过期**：`pnpm pr` / `pr:merge` / `pr:status` 在 package.json 中不存在（实为 `pnpm pr-review create/merge/status`）。
- **README 同款过时**：架构导航表 CI/CD 行仍写「`pnpm pr` 工作流命令」。
- **README 漏包**：导航表与全局结构均无 `@app/pr-review` 与 `packages/tsconfig`。
- **CONTRIBUTING §六 包清单漏 pr-review**（现写 `packages/{main,preload,renderer,shared,tsconfig}`）。
- 初版计划中「docs/adr 链接失效」「docs/code-review.md 不存在」「README specs/ 死链」三条已过时——这些文件/链接在当前主线均存在或已被并行提交修复。

## 7. 静态验收清单

- [ ] 根 `AGENTS.md` ≤ 60 行，只含 3 条全局红线 + 索引 + 路由 + 命令 + 指针
- [ ] 六个包规则文件齐全（pr-review 为薄件），条条可判定（无「注意 / 尽量」类措辞）
- [ ] 全仓规则单一真源：CONTRIBUTING / README / .agents/rules 与 AGENTS 体系无重复断言，重复处均为指针
- [ ] 博客六章覆盖：技术栈（根）/ 目录结构（包）/ 编码规范（包）/ 构建命令（根+包）/ Never（根3+包）/ 约定协作（根指针到 CONTRIBUTING）
- [ ] 所有指针链接真实存在（脚本提取 md 相对链接逐一校验）
- [ ] 新文件的目录树 / SOP 与源码实况一致（telemetry、handleTraced、wouter、logger.ts、utils/ 等均已核对）

## 8. 实施顺序（实际）

0. 重置分支到 main（c6162f9）✓
1. 根 AGENTS.md + 本计划 as-built 改版 ✓
2. main 拆分 ✓ → preload / shared 拆分 → renderer 拆分 + DESIGN.md → pr-review 薄件
3. CONTRIBUTING 收缩 + 入口指针；根 README AI 指针
4. 静态验收 + 链接校验
5. 分 3 个逻辑提交，走 `pnpm pr-review create` 提 PR（不自行合并）
