# AGENTS.md — AI 协作者目录与全局守则

> 本文件是 AI 编程助手（ZCode / Cursor / Claude Code 等）的项目入口：全局红线 + 全仓导航。
> 进入任何 `packages/` 目录工作前，先读该包的 `AGENTS.md`——cwd 在包内时它会自动注入；
> cwd 在根目录时按下方包索引主动读取。人类向总览见 [README.md](README.md)。

## 1. 技术栈速览

Electron 45（`contextIsolation` + `sandbox`）· React 19 + TypeScript · Vite 8（Rolldown 内核）·
Biome 2（格式化 + Lint）· LinguiJS 6（中文优先 Source-as-Key）· Vitest（单元）+
Playwright（E2E，真实 Electron 窗口）· pnpm 10 monorepo · Node >= 24

## 2. 全局红线（包无关，一句话可判定）

1. **根目录禁增业务依赖**：根 `package.json` 的 `dependencies` 只能包含 `@app/main`。
   （2026-10-18 立；门禁：CI `verify:deps`，规范见 [docs/dependency-rules.md](docs/dependency-rules.md)）
2. **禁止桶文件**：不得新增只做重导出的 `index.ts`，严禁 `export *`；Biome `noBarrelFile` /
   `noReExportAll` 为 error，不设白名单。组件 `Xxx/index.tsx`（一组件一文件夹的本体实现）不是桶文件，除外。
   （2026-10-18 立；例外澄清见 [CONTRIBUTING.md](CONTRIBUTING.md) §一.3）
3. **严禁 `process.cwd()` 算相对路径**：Node 脚本与构建配置必须用 `__dirname`。
   （2026-10-18 立；事由：桌面快捷方式启动时工作目录偏移；规范见 [CONTRIBUTING.md](CONTRIBUTING.md) §七）

## 3. 包索引（规则真源在各包 AGENTS.md）

| 包 | 职责 | 规则文件 |
| --- | --- | --- |
| `@app/main` | 主进程：Controller/Service 分层、窗口与系统生命周期 | [packages/main/AGENTS.md](packages/main/AGENTS.md) |
| `@app/preload` | 安全桥接层：contextBridge 暴露 `window.api` | [packages/preload/AGENTS.md](packages/preload/AGENTS.md) |
| `@app/renderer` | React 界面层：Feature 驱动 + LinguiJS | [packages/renderer/AGENTS.md](packages/renderer/AGENTS.md)（视觉另见 [DESIGN.md](packages/renderer/docs/DESIGN.md)） |
| `@app/shared` | 跨端契约单一事实源：Schema / 通道 / 类型 | [packages/shared/AGENTS.md](packages/shared/AGENTS.md) |
| `@app/pr-review` | PR 生命周期与 OCR 审查工具链 | [packages/pr-review/AGENTS.md](packages/pr-review/AGENTS.md) |

## 4. 任务路由（先读包规则，再查深档）

| 任务 | 先读 | 再查 |
| --- | --- | --- |
| 新增业务域（shared→preload→main→renderer 全链路） | 四包的 AGENTS.md | README「全栈端到端功能开发 SOP」 |
| 模块装配 / 启动流程 / 运行时 | main/AGENTS.md | docs/module-and-runtime-specification.md |
| 运行环境 / MODE / env 门面 | shared/AGENTS.md | docs/environment-specification.md |
| 依赖拓扑 / 打包隔离 / external | main/AGENTS.md | docs/dependency-rules.md |
| 路径管理 / 跨平台资源 / ASAR 避坑 | main/AGENTS.md | docs/electron-path-resolution-deep-dive.md |
| 打包产物 / 安装包 / OTA 升级 | main/AGENTS.md | docs/packaging-and-dependency-management.md · docs/electron-github-ota-deep-dive.md |
| renderer 页面 / 卡片 / 请求层 | renderer/AGENTS.md | — |
| 视觉 / token / 品牌定制 | renderer/docs/DESIGN.md | docs/template-customization-guide.md |
| 多语言词条与架构 | renderer/AGENTS.md | docs/i18n/guide.md · docs/i18n/architecture.md |
| 日志 / 异常 / 链路追踪 | .agents/rules/logging-specification.md | docs/logging-tracing-and-error-handling-guide.md · docs/logging-and-exception-audit.md |
| 首屏 / 启动壳 / WCO 标题栏 | main/AGENTS.md | docs/adr/0001-0003 · docs/wco-native-titlebar-integration.md |
| 测试 / 排错 / 提 PR / 触发 review | 全局红线 | docs/code-review.md · CONTRIBUTING §二 |
| 发版流程 / tag / changelogen | 全局红线 | .github/CICD.md · docs/adr/0004 |

## 5. 常用命令（根目录执行）

`pnpm start` / `start:dist` · `pnpm test` · `pnpm test:e2e` · `pnpm lint` / `lint:fix` ·
`pnpm typecheck` · `pnpm i18n:extract` · `pnpm build:dir` / `build:win` / `build:mac` /
`build:linux` · `pnpm verify:deps` · `pnpm pr-review <pull|trigger|create|status|merge>`

## 6. 指针

- 人类向全局工程规范（Biome 细节 / commit / husky / changelogen / .config / pnpm / CJS 脚本）：[CONTRIBUTING.md](CONTRIBUTING.md)
- 横切规则（globs 触发，落盘日志英文）：[.agents/rules/logging-specification.md](.agents/rules/logging-specification.md)
- 架构决策记录：docs/adr/（0001-0006）
