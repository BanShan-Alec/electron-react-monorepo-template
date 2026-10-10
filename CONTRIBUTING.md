# 项目贡献与工程规范指南 (Engineering Standards)

本项目采用严格的现代工程规范，通过自动化工具链保障代码质量、提交历史一致性与版本发布的规范性。

---

## 一、代码风格与静态检查规范 (Biome)

本项目使用 **[Biome](https://biomejs.dev/)** 作为统一的代码格式化器与静态检查器（Formatter & Linter），单二进制极速运行，替代繁重的 ESLint + Prettier。

### 1. 核心格式约定
- **缩进**：2 个空格（Space）
- **单行宽度**：100 字符
- **引号风格**：JS/TS 统一使用单引号（`single`），JSX 属性使用双引号（`double`）
- **语句结尾**：强制显式分号（`semicolons: "always"`）
- **尾随逗号**：多行自动补充（`trailingCommas: "all"`）
- **Import 组织**：自动按依赖类型与字典序整理导入顺序

### 2. 常用开发指令
```bash
# 检查整个项目的代码风格与规范
npm run lint

# 自动修复所有可修复的格式与 Lint 问题
npm run lint:fix

# 仅执行全局代码格式化
npm run format
```

### 3. 桶文件禁令（Barrel Files Ban）
本仓库**默认禁止桶文件**（只做重导出的 `index.ts` / `index.module.ts`），由 Biome `performance.noBarrelFile: "error"` 全库强制，不设白名单；配套 `noReExportAll` / `noImportCycles` 同为 error。跨模块一律直达具体文件导入。

**例外澄清**：组件的 `Xxx/index.tsx`（一组件一文件夹形态，index 内是组件本体实现，见 [packages/renderer/README.md](packages/renderer/README.md) "组件书写约定"）**不是桶文件**，不受本条约束；`noBarrelFile` 针对的仅是"只做重导出"的 index。

确需引入桶文件的唯一合法流程：评审 + 单条 override 豁免 + 显式命名导出 + 台账登记。

### 4. 请求 Hook 约束（manual-only）
渲染层异步数据请求一律使用 [`packages/renderer/src/hooks/useManualRequest.ts`](packages/renderer/src/hooks/useManualRequest.ts)（ahooks `useRequest` 的 manual-only 封装）：`manual` 已写死 `true`，请求发起只能是显式的 `run()/runAsync()`。

**一切自动触发能力一律禁止**：挂载自动触发、`refreshDeps` 依赖变化触发、`pollingInterval` 轮询、`refreshOnWindowFocus` 聚焦刷新、`ready` 门控、防抖/节流自动触发。触发点必须写在明处——事件处理器，或显式 `useEffect(() => run(...), [deps])`；挂载即拉取的语义保留。防抖用 `useDebounceFn`、轮询用 `useInterval`、聚焦刷新用 `useEventListener` 等 ahooks/React 组合实现。

三层强制：类型层（封装 `Omit` 掉全部自动触发键，传了即编译错误）、Lint 层（`noRestrictedImports` 禁止直连 `ahooks` `useRequest`，仅豁免封装文件）、评审层。

### 5. 构建工具链时代规则（Vite 8 / Rolldown / Oxc）

本仓已进入 Vite 8（rolldown 内核）时代：**新增构建期转换、插件与编译能力一律使用 Vite 8 / Rolldown / Oxc 原生 API**，禁止引入 esbuild、babel 等旧工具链依赖。存量 `@rolldown/plugin-babel` 仅限 lingui 既有用途，不扩用。选型参照 [ADR-0002](docs/adr/0002-startup-shell-build-time-inline.md)：单文件转译用 `transformWithOxc`（注意不打包 import），需打包时用程序化 `build()`（`configFile:false` + `write:false`）内存产出。

---

## 二、Git Commit 提交规范 (Conventional Commits)

本项目遵循国际通用的 **[Conventional Commits 1.0.0](https://www.conventionalcommits.org/)** 规范，并通过 **Commitlint** 与 **Husky** 在本地提交时进行自动化硬校验。

### 1. 提交信息结构
```text
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### 2. 允许的 Type 类型与中文示例
| Type | 说明 | 示例 |
| :--- | :--- | :--- |
| `feat` | 新增功能 / 新特性 | `feat(router): 增加系统托盘与原生交互能力` |
| `fix` | 修复缺陷或 Bug | `fix(window): 解决应用启动时的白屏闪烁问题` |
| `refactor` | 重构（既不新增功能，也不修复 Bug 的代码变动） | `refactor(scripts): 将启动与打包脚本迁移至 TypeScript` |
| `perf` | 性能提升与优化 | `perf(renderer): 优化仪表盘硬件信息的渲染性能` |
| `style` | 不影响代码逻辑的样式/格式变动 | `style: 依据 Biome 规范调整代码格式` |
| `docs` | 仅文档变动 | `docs: 完善项目规范与版本发布指南` |
| `test` | 增加或修改测试用例 | `test: 增加 tRPC 路由模块单元测试` |
| `build` | 构建系统、打包配置或外部依赖变动 | `build: 升级 electron-builder 构建配置` |
| `ci` | CI/CD 持续集成配置变更 | `ci: 优化 GitHub Actions 缓存机制` |
| `chore` | 日常维护、辅助工具或杂项 | `chore: 接入 changelogen 自动化版本管理` |
| `revert` | 回滚先前的提交 | `revert: 回滚提交 32cb089` |

### 3. 硬性要求
- **提交说明强制使用简体中文**：`description`（Subject 部分）**必须包含简体中文**，杜绝使用英文或无意义拼音敷衍，否则会被 Commitlint 钩子硬拦截；
- `type` 必须全小写；
- 冒号 `:` 后面必须有一个英文空格；
- 示例：`feat: 增加文件选择原生对话框` 或 `fix(ipc): 修复外部链接协议未校验的安全隐患`。

### 4. PR 工作流（`pnpm pr`）

feature 分支一律经 PR 合入 `main`：分支保护锁死 required checks（typecheck / lint / e2e）与 squash-only、拒绝直推，决策背景见 [ADR-0004](docs/adr/0004-pr-only-squash-workflow.md)，完整流程见 [.github/CICD.md](.github/CICD.md) 的「提交与 PR」「合并」章节。

| 命令 | 用途 |
| :--- | :--- |
| `pnpm pr` | 前置检查 → push → 开 PR（标题取分支首个提交，正文读模板） |
| `pnpm pr:merge` | 等门禁全绿 → squash 合并 → 删远端分支 |
| `pnpm pr:status` | 当前仓库 PR 与 checks 概览 |

PR 标题沿用本节 Conventional Commits 格式（squash 后即 main 提交信息、进 changelog），分支首个提交的 subject 请按此措辞。

---

## 三、Git 自动化工作流 (Husky + lint-staged)

代码提交时将自动触发两道质量守卫：

1. **Pre-commit 钩子 (`.husky/pre-commit`)**：
   - 触发 `lint-staged`，对本次暂存区（Git Staged）的文件运行 `biome check --write`。
   - 自动格式化被修改的文件，若存在无法自动修复的语法/Lint 报错则中断提交。
2. **Commit-msg 钩子 (`.husky/commit-msg`)**：
   - 触发 `commitlint` 检验提交信息：必须符合 Conventional Commits 规范且**必须包含简体中文说明**。

---

## 四、版本号与 CHANGELOG 自动化管理 (changelogen)

本项目采用 **[changelogen](https://github.com/unjs/changelogen)** 自动化解析 Git 提交记录、智能推导版本演进并生成美观的变更日志。

### 1. 常用版本管理指令
```bash
# 1. 预览即将生成的 CHANGELOG（不修改任何文件）
npm run changelog

# 2. 自动根据 Commit 历史推导语义化版本（feat 触发 minor，fix 触发 patch），
#    并自动更新 package.json、生成 CHANGELOG.md、执行 git commit 以及创建 git tag
npm run release

# 3. 显式指定版本步长进行 Release：
npm run release:patch   # 补丁升级（如 3.1.0 -> 3.1.1）
npm run release:minor   # 次版本升级（如 3.1.0 -> 3.2.0）
npm run release:major   # 主版本升级（如 3.1.0 -> 4.0.0）
```

### 2. 发布流程规范（PR 化）

main 受分支保护禁直推，发版走 PR 形态：

1. 从 main 切 `chore/release-vX.Y.Z` 分支；确认 lint / typecheck 为 0 错误后运行 Release 命令（如 `npm run release:minor`，生成版本号与 CHANGELOG 提交）；
2. `pnpm pr` 开发版 PR；**删除分支上的本地 tag**（`git tag -d vX.Y.Z`，squash 合并会改变提交 SHA，旧 tag 作废）；
3. PR 合并后在 main 上重新打 tag 并推送：
   ```bash
   git pull && git tag vX.Y.Z && git push origin vX.Y.Z
   ```
4. GitHub Actions 将监听推送到远端的版本 Tag（如 `v1.1.0`），自动构建 Windows、macOS 与 Linux 原生安装包并发布到 GitHub Releases。

---

## 五、工程配置文件收拢规范 (.config/ 与 build/)

为保持项目根目录极致清爽，工具链配置与构建资产按职责收拢存放。

`.config/` —— Lint 与版本发布工具链配置：
- [`.config/biome.json`](.config/biome.json)：Biome 代码格式化与 Lint 校验规则
- [`.config/commitlint.config.ts`](.config/commitlint.config.ts)：Conventional Commits 校验与简体中文要求插件
- [`.config/changelog.config.ts`](.config/changelog.config.ts)：changelogen 变更日志分类映射与版本推导配置

`build/` —— 生产构建与打包域：
- [`build/electron-builder.ts`](build/electron-builder.ts)：Electron 生产环境打包配置与过滤规则
- [`build/sentry-config.ts`](build/sentry-config.ts)：Sentry 构建期公共配置、版本号提取与 DSN 注入器
- [`build/resources/`](build/resources)：打包资源（应用图标、签名 entitlements 等），经 `extraResources` 复制进安装包

---

## 六、依赖管理与安装规范 (pnpm Workspace)

本项目为 pnpm monorepo（`packageManager: pnpm@10.34.5`），子包位于 `packages/{main,preload,renderer,shared,tsconfig}`，`pnpm-workspace.yaml` 的 `catalog:` 段统一收敛跨包共享依赖版本，依赖实体统一落在根 `node_modules/.pnpm`。以下命令均在**根目录**执行。

### 1. 常用命令速查

| 场景 | 命令 |
| :--- | :--- |
| 全量安装 / 同步 lockfile | `pnpm install` |
| 根 package.json 加 dev 依赖 | `pnpm add -Dw <包名>` |
| 根 package.json 加生产依赖 | `pnpm add -w <包名>` |
| 指定子包装依赖 | `pnpm -F @app/renderer add <包名>` |
| 写死版本、不走 catalog | `pnpm add -Dw <包名>@<版本>` |

### 2. 常用缩写与安装位置规则

`-w`（`--workspace-root`，装到 workspace 根）、`-D`（`--save-dev`）、`-P`（`--save-prod`，默认）、`-E`（`--save-exact`，锁精确版本）、`-O`（`--save-optional`）、`-F`（`--filter`，指定子包，如 `-F @app/renderer`）、`-r`（`--recursive`）。

`pnpm add` 默认写入**当前目录所属**的 `package.json`：根目录执行即落在根；子包目录下执行则落在该子包。消除歧义——装到根统一加 `-w`，装到子包统一 `pnpm -F <包名> add`，无需 cd 进子包。

### 3. catalog 版本收敛

安装的包命中 `pnpm-workspace.yaml` 的 `catalog:`（如 `typescript` / `vite` / `zod` / `react`）时，`pnpm add` 自动使用 `catalog:` 协议，真实版本收敛到 workspace 根。需在 `package.json` 写死版本、不跟随 catalog 时，指定与 catalog 不同的版本即可（catalog 中没有的包自然写成普通 semver 区间）：

```bash
pnpm add -Dw zod@4.7.1
```

### 4. 升级与卸载

```bash
pnpm up -wri                       # 交互式升级（-w 根，-r 递归，-i 交互）
pnpm up -w zod@latest              # 升级指定包
pnpm -F @app/main up electron-log  # 子包升级
pnpm remove -w <包名>             # 卸载（-F 同理卸载子包依赖）
pnpm -F @app/renderer remove <包名>
```

---

## 七、Node 脚本与构建配置规范 (纯 CommonJS 模式)

为彻底杜绝 Node 22+ 原生执行 TypeScript 时的 `[MODULE_TYPELESS_PACKAGE_JSON]` 重新解析警告，并消除 `import.meta.url`、`fileURLToPath`、`__dirname` 兼容垫片与动态导入陷阱，本项目制定以下规范：

### 1. 运行环境与模块标准划分

| 目录与文件 | 模块系统 | 规范要求与说明 |
| :--- | :--- | :--- |
| **Node 脚本与构建配置**<br>`scripts/*.ts`<br>`build/*.ts`<br>`packages/{main,preload}/vite.config.ts` | **纯 CommonJS** (`require` / `module.exports`) | • 统一使用 `require('node:xxx')` 引入依赖，禁止混入 ESM `import`。<br>• 统一使用原生标准 `__dirname`，严禁编写 `typeof __dirname !== 'undefined'` 等兼容垫片。<br>• 直接使用 `module.exports = { ... }` 导出。<br>• CLI 直接执行入口使用 `if (require.main === module)` 判断。<br>• TypeScript 类型引入使用零运行时的 `import type { ... } from '...'`。 |
| **纯前端渲染进程**<br>`packages/renderer/`（含 `vite.config.ts`） | **原生 ESM** (`import` / `export`) | • `packages/renderer/package.json` 显式声明 `"type": "module"`，完整支持 Vite 与 React 前端生态。<br>• 若需在渲染端配置中引入 `build/` 下的 CommonJS 模块，通过 `createRequire(import.meta.url)` 桥接载入。 |

### 2. TypeScript 隔离配置
`scripts/tsconfig.json` 配置了 `"moduleDetection": "force"`，确保即使未显式声明顶层 `export` 的纯 CJS 脚本也能在 TypeScript 中保持独立的模块作用域，杜绝跨文件全局变量污染（如全局 `const fs` 冲突）。

