# AGENTS.md Monorepo 分层重构计划

- 日期：2026-10-16
- 状态：待评审（grilling 已闭环，全部按推荐定稿）
- 建议分支：`docs/agents-md-monorepo-refactor`（自 `docs/template-optimization` 切出）
- 背景：参考掘金《一份 AGENTS.md，让 AI 代码规范率从 60% 飙升到 95%》六章框架，针对本仓 monorepo 形态重新设计文档分层

---

## 1. 已定决策（grilling 结论）

1. **根 `AGENTS.md` = 纯目录**：3 条全局红线 + 包索引 + 两级任务路由表 + 指针区；mermaid 决策树转为表格（AI 读 markdown 源码，流程图是噪音）。
2. **包规则拆出 README**：目录树 / 铁律 / 严禁清单 / SOP / 命名规范 / 门禁命令全量搬进 `packages/*/AGENTS.md`；README 退居人类向 overview（定位、快速命令、设计取舍之"为什么"、跨包关联）+ 一行 AI 指针。
3. **视觉规范独立文件** `packages/renderer/docs/DESIGN.md`：纪律+指针型（约 25 行），**不复制色板**——颜色真源在 `tokens.css`，文档抄色板即制造双源。
4. **`.agents/rules/logging-specification.md` 保留**（Cursor globs 模式），根文件加一行显式索引补 ZCode 侧可见性。
5. **CONTRIBUTING 收缩**为全局人类规范：包级规则（manual-only 等）下沉，§八 文档同步纪律扩展覆盖 AGENTS 体系。
6. **`AGENT.md` → `AGENTS.md` 更名先行**：ZCode 官方口径只认复数名，现文件从未被自动注入，入口不加载则全套指针是死的。
7. **Never 规则行内出处**：`（YYYY-MM-DD，事由一句话）`；挖不出故事的标迁移来源，不硬编日期。
8. **验收 = 静态清单 + 用户一次性行为抽检**：静态部分随交付可勾选；行为抽检验货由用户执行，不自批自阅。

---

## 2. 目标结构

```
AGENTS.md                                  # 根：目录 + 3 条全局红线 + 两级路由 + 命令 + 指针（≤60 行）
packages/
├── main/AGENTS.md                         # 包规则（树+依赖表+铁律5+严禁4+SOP+门禁）
├── preload/AGENTS.md                      # 包规则（树+编写规则3）
├── renderer/AGENTS.md                     # 包规则（树+Feature规范6+sections铁律5+组件约定+请求层+i18n+门禁）
├── renderer/docs/DESIGN.md                # 视觉纪律与指针（~25 行，新文件）
├── shared/AGENTS.md                       # 包规则（树+设计原则6+命名表+SOP）
└── pr-review/AGENTS.md                    # 薄件（3 条，~10 行）
.agents/rules/logging-specification.md     # 不动（globs 横切规则），根索引一行
CONTRIBUTING.md                            # 收缩为全局人类规范 + 指针网
docs/1-5、README.md                         # 仅更新 AGENT.md 引用（更名波及）
docs/human/、docs/plan/                     # 历史存档，零改动
```

---

## 3. 根 `AGENTS.md` 最终形态（章节骨架）

```
# AGENTS.md — AI 协作者目录与全局守则

> 本文件是 AI 协作者入口：全局红线 + 全仓导航。
> 进入任何 packages/ 目录工作前，先读该包的 AGENTS.md——
> cwd 在包内时它会被自动注入；cwd 在根时按下方索引读取。

## 1. 技术栈（速览）
Electron 41（contextIsolation + sandbox）· React 19 + TS 5.8 ·
Vite 8（Rolldown）· Biome · LinguiJS 6 · Vitest 3 + Playwright · pnpm 10 monorepo

## 2. 全局红线（包无关，一句话可判定）
1. 根 package.json 的 dependencies 只能包含 @app/main（2026-10-16 迁移自旧红线 1）
2. 禁止桶文件：不得新增只做重导出的 index.ts，严禁 export *；
   Biome noBarrelFile 强制，组件 Xxx/index.tsx（本体实现）除外
   （2026-10-16 迁移自旧红线 2；例外澄清见 CONTRIBUTING §一.3）
3. 严禁 process.cwd() 计算相对路径，必须用 __dirname
   （2026-10-16 迁移自旧红线 5；事由：桌面快捷方式启动时工作目录偏移）

## 3. 包索引（规则真源在各包 AGENTS.md）
| 包 | 职责 | 规则文件 |
| main | 主进程：窗口 / 原生 / IPC | packages/main/AGENTS.md |
| preload | 安全桥接层 | packages/preload/AGENTS.md |
| renderer | React 界面层 | packages/renderer/AGENTS.md（视觉另见 packages/renderer/docs/DESIGN.md） |
| shared | 跨端契约单一事实源 | packages/shared/AGENTS.md |
| pr-review | PR 生命周期 / OCR 工具链 | packages/pr-review/AGENTS.md |

## 4. 任务路由（先读包规则，再查深档）
| 任务 | 先读 | 再查 |
| 新增业务域（shared→preload→main→renderer 全链路） | shared + main + preload + renderer 的 AGENTS.md | docs/2 |
| 新增 renderer 页面 / 卡片 / 样式 | renderer/AGENTS.md（+ DESIGN.md） | docs/3 |
| 视觉 / token / 品牌定制 | renderer/docs/DESIGN.md | docs/1 |
| 测试 / 排错 / 提 PR / 触发 review | 全局红线 | docs/4 |
| 打包 / 发布 / OTA | 全局红线 | docs/5 |
| 落盘日志文案 | .agents/rules/logging-specification.md | docs/4 |

## 5. 常用命令
pnpm start / start:dist · pnpm test · pnpm test:e2e · pnpm lint · pnpm typecheck ·
pnpm i18n:extract · pnpm pr-review <pull|trigger|create|status|merge>

## 6. 指针
- 人类向全局工程规范：CONTRIBUTING.md（Biome 细节 / commit / husky / changelogen / .config / pnpm / CJS 脚本）
- 横切规则：.agents/rules/logging-specification.md（globs 触发，落盘日志英文）
- 生命周期深档：docs/1-init … docs/5-build-release-and-ota
```

被下沉的两条旧红线的归宿：#3 IPC 契约 → main/preload/shared 三个包文件（原本就在三处 README 有更强表述）；#4 日志英文 → `.agents/rules/logging-specification.md`（原本就存在，根索引补可见性）。

---

## 4. 逐包拆分映射

### packages/main（README 153 行）

| 现章节 | 去向 |
| --- | --- |
| §1 目录职责总览（树 + 依赖方向表） | → AGENTS.md |
| §2 核心架构铁律 5 条 | → AGENTS.md（铁律 4 自带的 handleTraced 事由原文保留为出处） |
| §3 AI 编码严禁清单 4 条 | → AGENTS.md |
| §4 新增业务领域 SOP（三步 + 完整代码） | → AGENTS.md |
| §5 横切关注点与提交前门禁 | 拆：门禁命令 → AGENTS.md；横切叙述（ModuleRunner 链位、追踪、崩溃）→ 留 README |
| §6 跨包关联 | 留 README，新增 AI 指针行 |

README 终态约 60 行：定位段 + 横切叙述 + 跨包关联 + 指针。

### packages/renderer（README 203 行）

| 现章节 | 去向 |
| --- | --- |
| §目录总览 | → AGENTS.md |
| §分层依据 | 拆：规则句（单向依赖、feature 禁互 import、dashboard 唯一例外）→ AGENTS.md；"为什么这样分层"叙述 → 留 README |
| §Feature 规范 6 条 + sections 铁律 5 条 | → AGENTS.md |
| §请求层 + 日志纪律 | → AGENTS.md，并入 CONTRIBUTING §一.4 manual-only 的浓缩（三层强制） |
| §组件书写约定 | → AGENTS.md |
| §国际化 i18n | → AGENTS.md |
| §架构取舍与设计裁决 | 留 README（why） |
| §跨包与文档关联 | 留 README，新增 AI 指针行 |

README 终态约 70 行：定位 + 快速命令 + 分层依据（why）+ 架构取舍 + 跨包关联 + 指针。

### packages/shared（README 176 行）

| 现章节 | 去向 |
| --- | --- |
| §1 目录架构 | → AGENTS.md |
| §2 核心设计原则 6 节 | → AGENTS.md |
| §3 命名规范表 | → AGENTS.md |
| §4 新增业务领域 SOP | → AGENTS.md |
| §5 跨包关联 | 留 README，新增 AI 指针行 |

README 终态约 30 行：单一事实源定位论述 + 跨包关联 + 指针。

### packages/preload（README 54 行）

| 现章节 | 去向 |
| --- | --- |
| §2 目录与实现规范 + 编写规则 3 条 | → AGENTS.md |
| §1 核心定位与职责（沙箱 / 契约 / 环境注入叙述） | 留 README |

README 终态约 35 行：定位 + 跨包关联 + 指针。

### packages/pr-review（README 109 行）

工具包，无代码规范。README 不动，新建薄件 `AGENTS.md`（约 10 行）：

1. 改本包代码前必读 `.agents/skills/pr-review/SKILL.md`（命令契约与 OCR 配置口径）
2. CLI 入口只在 `src/cli.ts` 增删命令，`pnpm pr-review` 是唯一对外入口
3. `reviews/` 为运行产物目录（看板），只读不手改；10 轮自动清理

---

## 5. CONTRIBUTING.md 变更

- **§一.3 桶文件禁令**：保留（全局规则的详版），文末加指针"包内形态见各包 AGENTS.md；组件例外见 renderer/AGENTS.md"。
- **§一.4 请求 Hook 约束**：压缩为 3 行指针，规则本体进 renderer/AGENTS.md 请求层（消除现存的双表述）。
- **§一.5 构建工具链时代规则**：保留全局（横跨 renderer 插件与 scripts）。
- **§二 commit / PR**：保留；§二.4 命令过期问题见 §10 顺带发现。
- **§八 文档同步纪律**：扩展一句——"包职责 / 目录 / 规则变更，必须同步：该包 AGENTS.md → 该包 README 指针 → 根 AGENTS.md 索引"。
- **文件头新增"AI 协作者入口"指针**：一行指向根 AGENTS.md。

重复政策：**"零重复"针对规则断言**（每条规则全仓只有一个真源）；**命令字符串允许重复**（`pnpm lint` 这类零漂移风险）。

---

## 6. packages/renderer/docs/DESIGN.md 大纲（约 25 行）

```markdown
# DESIGN.md — renderer 视觉规范（纪律与指针）

AI 在 renderer 写样式时唯一需要遵守的视觉纪律；品牌定制入口见文末。

## 纪律
1. 禁硬编码颜色 / 间距 / 字体值——一律 var(--color-*) 或 Tailwind 主题类（bg-primary 等）
2. 改品牌 = 改 token，不改组件。三个文件：
   src/styles/tokens.css（CSS 变量唯一定义）→ tailwind.config.ts（映射）→ antd-theme.ts（antd 镜像）
3. antd 组件样式只经 antd-theme.ts / ConfigProvider，不写 :global 覆盖
4. 深浅色由 darkMode: 'class' + documentElement.dataset.theme 驱动（useTheme），不读 prefers-color-scheme 自行判断

## 指针
- 当前品牌色值以 tokens.css 为唯一真源，本文不复制色板（避免双源漂移）
- 品牌定制（换 logo / 主色）入口：docs/1-init-and-customization.md
```

---

## 7. 更名波及清单（`AGENT.md` → `AGENTS.md`）

| 文件 | 位置 | 处理 |
| --- | --- | --- |
| `AGENT.md` | 根 | `git mv` 后内容整体重写为 §3 形态 |
| `README.md` | :22、:208 | 更新两处链接与措辞 |
| `docs/1-init-and-customization.md` | :18 | 目录树注释行更新（编辑前重读全文） |
| `docs/4-testing-quality-and-ai-review.md` | :55、:62 | §3 标题与正文更新（编辑前重读全节，防漏引用） |
| `docs/human/*`、`docs/plan/*` | 2026-10-13 存档 | **不动**——带日期的快照，改写即篡改记录 |
| `.github/`、`CONTRIBUTING.md` | — | 现无单数名引用；CONTRIBUTING 按 §5 新增指针时用新名 |

验收：现役文档中 `grep -rn "AGENT\.md"` 零残留（存档除外）。

---

## 8. 静态验收清单（交付时逐项勾选）

- [ ] 根 `AGENTS.md` ≤ 60 行，只含 3 条全局红线 + 索引 + 路由 + 命令 + 指针
- [ ] 五个包规则文件齐全（pr-review 为薄件），每条铁律 / 严禁可判定（无"注意""尽量""保持统一"类措辞）
- [ ] 全仓规则单一真源：CONTRIBUTING / README / .agents/rules 与 AGENTS 体系之间无重复断言，重复处均为指针
- [ ] 博客六章覆盖：技术栈（根）/ 目录结构（包）/ 编码规范（包）/ 构建命令（根+包）/ Never（根3+包）/ 约定协作（根指针到 CONTRIBUTING）
- [ ] 所有指针链接真实存在（脚本提取全部 md 相对链接逐一做存在性检查）
- [ ] `docs/human/`、`docs/plan/` 存档零改动
- [ ] 现役文档无 `AGENT.md`（单数）残留
- [ ] 旧红线 #3（IPC 契约）在 main/preload/shared 三个包文件均有等价或更强表述；#4（日志英文）在 .agents/rules 有真源且根索引可见

## 9. 行为抽检（交付后由用户执行）

1. 在新规范下让 AI 写一个 renderer 组件（验：一组件一文件夹、token 纪律、请求层选择）
2. 走一次提 PR 流程（验：根路由表把 AI 引向 pr-review 与 docs/4）
与旧规范下的产出对比，记录差距；不达预期的条目回炉进对应包文件。

---

## 10. 实施顺序

0. 自 `docs/template-optimization` 切 `docs/agents-md-monorepo-refactor`
1. **更名 + 新根文件**（入口先活，否则全套指针无效）
2. main 拆分（树 / 铁律 / 严禁 / SOP → AGENTS.md；README 瘦身）
3. preload、shared 拆分（小包先行，验证拆分模式）
4. renderer 拆分 + `renderer/docs/DESIGN.md`（最大包，模式已验证后做）
5. pr-review 薄件
6. CONTRIBUTING 收缩 + §八 扩展 + 入口指针
7. 跑静态验收清单 + 链接校验脚本
8. 用户行为抽检（两项）
9. PR 合入：squash，标题按 Conventional Commits 中文要求，如 `docs(agents): 重构 AGENTS.md 为 monorepo 分层目录体系`

---

## 11. 顺带发现（本次范围外，建议另开 PR）

- **CONTRIBUTING §二.4 命令过期**：`pnpm pr` / `pnpm pr:merge` / `pnpm pr:status` 三个命令在 package.json 中不存在（实为 `pnpm pr-review create/merge/status`）；文中 `docs/code-review.md` 链接不存在。
- **CONTRIBUTING §六 包清单漏 pr-review**：现写 `packages/{main,preload,renderer,shared,tsconfig}`，漏 `pr-review`。
- **ADR 链接失效**：CONTRIBUTING 引用 `docs/adr/0002`、`docs/adr/0004`，`docs/` 下无 `adr/` 目录。
- **规则缺口**：`e2e/` 与 `scripts/` 无专属规则文件，当前靠根路由表指 docs/4 兜底；如后续 AI 在 e2e 频繁出错，可各补薄件。
