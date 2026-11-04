# AGENTS.md — AI 协作者目录与全局守则

> 本文件是 AI 编程助手（ZCode / Cursor / Claude Code 等）的项目入口：全局红线 + 全仓导航。
> 进入任何 `packages/` 目录工作前，先读该包的 `AGENTS.md`——cwd 在包内时它会自动注入；
> cwd 在根目录时按下方包索引主动读取。人类向总览见 [README.md](README.md)。

## 1. 技术栈速览

Electron 45（`contextIsolation` + `sandbox`）· React 19 + TypeScript · Vite 8（Rolldown 内核）·
Biome 2（格式化 + Lint）· LinguiJS 6（中文优先 Source-as-Key）· Vitest（单元）+
Playwright（E2E，真实 Electron 窗口）· pnpm 12 monorepo · Node >= 24

## 2. 全局红线（包无关，一句话可判定）

1. **根目录禁增业务依赖**：根 `package.json` 的 `dependencies` 只能包含 `@app/main`。
   （2026-10-18 立；门禁：CI `verify:prebuild`）
2. **禁止桶文件**：不得新增只做重导出的 `index.ts`，严禁 `export *`；Biome `noBarrelFile` /
   `noReExportAll` 为 error，不设白名单。组件 `Xxx/index.tsx`（一组件一文件夹的本体实现）不是桶文件，除外。
   （2026-10-18 立；例外澄清见 [CONTRIBUTING.md](CONTRIBUTING.md) §一.3）
3. **路径推导最佳实践（非阻断门禁）**：Node 脚本与构建配置推荐优先基于 `__dirname` / `import.meta.dirname` 推导绝对路径，避免依赖 `process.cwd()` 产生工作目录偏移风险；作为工程指导原则遵循，非硬性机械阻断门禁。
   （2026-10-18 立；事由：桌面快捷方式启动时工作目录偏移；规范见 [CONTRIBUTING.md](CONTRIBUTING.md) §七）

## 3. 包索引（规则真源在各包 AGENTS.md）

| 包               | 职责                                                | 规则文件                                                                                                             |
| ---------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `@app/main`      | 主进程：Controller/Service 分层、窗口与系统生命周期 | [packages/main/AGENTS.md](packages/main/AGENTS.md)                                                                   |
| `@app/preload`   | 安全桥接层：contextBridge 暴露 `window.api`         | [packages/preload/AGENTS.md](packages/preload/AGENTS.md)                                                             |
| `@app/renderer`  | React 界面层：Feature 驱动 + LinguiJS               | [packages/renderer/AGENTS.md](packages/renderer/AGENTS.md)（视觉另见 [DESIGN.md](packages/renderer/docs/DESIGN.md)） |
| `@app/shared`    | 跨端契约单一事实源：Schema / 通道 / 类型            | [packages/shared/AGENTS.md](packages/shared/AGENTS.md)                                                               |
| `@app/pr-review` | PR 生命周期与 OCR 审查工具链                        | [packages/pr-review/AGENTS.md](packages/pr-review/AGENTS.md)                                                         |
| `@app/docs`      | 解决方案合集文档站（Vocs，GitHub Pages 部署）       | [packages/docs/AGENTS.md](packages/docs/AGENTS.md)                                                                   |

## 4. 任务路由（先读包规则，再查深档）

| 任务                                              | 先读                                   | 再查                                                                                                                        |
| ------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 新增业务域（shared→preload→main→renderer 全链路） | 四包的 AGENTS.md                       | packages/docs/src/pages/ai/fullstack-sop.md                                                                                 |
| 模块装配 / 启动流程 / 运行时                      | main/AGENTS.md                         | packages/docs/src/pages/architecture/module-lifecycle.md · packages/docs/src/pages/architecture/layering.md                 |
| 运行环境 / MODE / env 门面                        | shared/AGENTS.md                       | packages/docs/src/pages/engineering/env-vars.md · packages/docs/src/pages/dx/dev-orchestration.md                           |
| 依赖拓扑 / 打包隔离 / external                    | main/AGENTS.md                         | packages/docs/src/pages/engineering/dependency-management.md                                                                |
| 路径管理 / 跨平台资源 / ASAR 避坑                 | main/AGENTS.md                         | packages/docs/src/pages/security/path-robustness.md                                                                         |
| 打包产物 / 安装包 / OTA 升级                      | main/AGENTS.md                         | packages/docs/src/pages/delivery/packaging.md · packages/docs/src/pages/delivery/auto-update.md                             |
| renderer 页面 / 卡片 / 请求层                     | renderer/AGENTS.md                     | —                                                                                                                           |
| 文档站页面 / 导航 / 写作规范                      | packages/docs/AGENTS.md                | —                                                                                                                           |
| 视觉 / token / 品牌定制                           | renderer/docs/DESIGN.md                | packages/docs/src/pages/ui/design-tokens.md                                                                                 |
| 多语言词条与架构                                  | renderer/AGENTS.md                     | packages/docs/src/pages/ui/i18n.md                                                                                          |
| 日志 / 异常 / 链路追踪                            | .agents/rules/logging-specification.md | packages/docs/src/pages/main/logging.md · packages/docs/src/pages/main/tracing.md                                           |
| 首屏 / 启动壳 / WCO 标题栏                        | main/AGENTS.md                         | packages/docs/src/pages/ui/first-screen.md · packages/docs/src/pages/ui/wco.md · packages/docs/src/pages/ui/window-state.md |
| 测试 / 排错 / 提 PR / 触发 review                 | 全局红线                               | packages/docs/src/pages/ai/review-loop.md · CONTRIBUTING §二                                                                |
| 发版流程 / tag / changelogen                      | 全局红线                               | .github/CICD.md                                                                                                             |

## 5. 开发流与验证门禁矩阵（根目录执行）

| 研发场景               | 机器门禁判据与组合命令                                             | 拦截重点与避坑指南                                                     |
| :--------------------- | :----------------------------------------------------------------- | :--------------------------------------------------------------------- |
| **日常编码闭环**       | `pnpm typecheck` · `pnpm lint` · `pnpm test`                       | 快速增量校验，单测覆盖 19 个核心测试套件与 101 个用例                  |
| **PR 提交前全量门禁**  | `pnpm typecheck && pnpm lint && pnpm test && pnpm verify:prebuild` | 必须全绿方可提 PR；CI 将执行相同流水线阻断合并                         |
| **PR 生命周期管理**    | `pnpm pr-review <create\|status\|pull\|trigger\|merge>`            | 统一收敛命令，严禁手写散装 gh 命令；实现审阅与合并闭环                 |
| **pr-review 模块改动** | `pnpm test:pr-review`                                              | ⚠️ **关键判据**：根 `pnpm test` 排除了本包，改动后必须单独执行此命令！ |
| **多语言文案变动**     | `pnpm i18n:extract` ➔ 补译 ➔ `pnpm i18n:check`                     | `messages.po` 缺少英译将直接导致 CI 失败                               |
| **文档站内容变动**     | `pnpm docs:dev`（本地预览）· `pnpm docs:build`（静态构建）         | 构建包含死链检测与 SSG 静态生成                                        |
| **发版与分发预检**     | `pnpm verify:prebuild` · `pnpm build:unpack`                       | 检查主进程 external 依赖隔离，验证打包产物完整性                       |

## 6. 指针

- 人类向全局工程规范（Biome 细节 / commit / husky / changelogen / .config / pnpm / CJS 脚本）：[CONTRIBUTING.md](CONTRIBUTING.md)
- 横切规则（globs 触发，落盘日志英文）：[.agents/rules/logging-specification.md](.agents/rules/logging-specification.md)

## 7. 模块系统与脚本执行约定

- **全仓 ESM-only**：包源码统一 ES Module；`.ts` 脚本用 `tsx` 直接执行（`scripts/*.ts`、pr-review CLI），不引入 ts-node/CJS 包装。
- **main / preload 产物是 CJS**：Vite 以 lib 形式输出 `dist/index.cjs`，`package.json` 的 `main`/`exports` 指向它；源码仍是 ESM，由构建器转译。
- **renderer 的 Node 隔离是约定、未机械 enforce**：靠 `packages/tsconfig/react.json` 的 `types: ["vite/client"]` 白名单约束，但 `vite.config.ts` 与 `src` 同属一个 program，Node 类型会经 `vite` 传递进来。不要在 renderer 里 `import 'node:fs'` 或使用 `__dirname` / `process`，typecheck 不会拦。
