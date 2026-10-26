# AI 协作者约定（AGENTS.md 分层与红线）

> **TL;DR**：根 AGENTS.md 放全局红线与任务路由，各包 AGENTS.md 放本包铁律，AI 进场先读规则再动手。

## 要解决的坑

- 仓库知识散在 README、CONTRIBUTING 和各个包的注释里：AI 进场先猜一轮，该读哪个文件、哪条规则优先、改错了谁来拦
- 「根目录不能加依赖」「不要写桶文件」这类经验只活在人的脑子里，AI 无从判定，只能等 Review 阶段被指出
- 同一套约定在每个包重抄一遍，改一处漏四处
- 没有导航：问「加一个业务域要动哪些包」，得到的是泛泛而谈，而不是一份可执行的阅读顺序

## 本仓库的解法

### 1. 两层 AGENTS.md：根管全局，包管局部

→ 源码：[AGENTS.md](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/AGENTS.md) · [packages/main/AGENTS.md](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/AGENTS.md) · [packages/preload/AGENTS.md](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/preload/AGENTS.md) · [packages/renderer/AGENTS.md](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/AGENTS.md) · [packages/shared/AGENTS.md](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/AGENTS.md) · [packages/pr-review/AGENTS.md](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/pr-review/AGENTS.md)

根 `AGENTS.md` 的六节构成固定的入口顺序：技术栈速览 → 全局红线 → 包索引 → 任务路由 → 常用命令 → 指针。包无关的底线、包索引与任务路由集中在入口一处，常用命令与指针收尾。

包索引把每个包的职责与规则文件列成一张表：

| 包 | 职责 | 规则文件 |
| --- | --- | --- |
| `@app/main` | 主进程：Controller/Service 分层、窗口与系统生命周期 | `packages/main/AGENTS.md` |
| `@app/preload` | 安全桥接层：contextBridge 暴露 `window.api` | `packages/preload/AGENTS.md` |
| `@app/renderer` | React 界面层：Feature 驱动 + LinguiJS | `packages/renderer/AGENTS.md`（视觉另见 `packages/renderer/docs/DESIGN.md`） |
| `@app/shared` | 跨端契约单一事实源：Schema / 通道 / 类型 | `packages/shared/AGENTS.md` |
| `@app/pr-review` | PR 生命周期与 OCR 审查工具链 | `packages/pr-review/AGENTS.md` |
| `@app/docs` | 解决方案合集文档站（Vocs，GitHub Pages 部署） | — |

四个主包的文件开头都声明同一件事——「本文件是该包规则的唯一真源」，README 不再承载目录树、铁律或 SOP，并回链根 `AGENTS.md`。`@app/pr-review` 从简，只有三条：改本包代码前读 Skill、CLI 入口收敛、`reviews/` 只读不手改。

### 2. 三条全局红线（一句话可判定）

三条红线都写成单句可判定的形式，且各自挂在一个机器检查点上。

**根目录禁增业务依赖**：根 `package.json` 的 `dependencies` 只能包含 `@app/main`。

```json
"dependencies": {
  "@app/main": "workspace:*"
},
```

打包前置门禁把白名单写死，build 脚本在 electron-builder 启动前调用它：

```ts
const rootDeps = Object.keys(rootPkg.dependencies || {});
const allowedRootDeps = ['@app/main'];

const illegalRootDeps = rootDeps.filter((dep) => !allowedRootDeps.includes(dep));
```

→ 源码：[scripts/verify-prebuild.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/verify-prebuild.ts)（`pnpm verify:prebuild` 可单独运行）

**禁止桶文件**：不得新增只做重导出的 `index.ts`，严禁 `export *`。

```json
"performance": {
  "noBarrelFile": "error",
  "noReExportAll": "error"
},
```

→ 源码：[.config/biome.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.config/biome.json)

两条规则都是 error 级、不设白名单。例外同样写在根文件里：组件 `Xxx/index.tsx` 是一组件一文件夹的本体实现，不是桶文件。`@app/shared` 把这条红线推到极端——`package.json` 连根入口都不设，用子路径 `exports` 直出具体文件：

```json
"exports": {
  "./constants/*": "./src/constants/*.ts",
  "./schemas/*": "./src/schemas/*.ts",
  "./types/*": "./src/types/*.ts",
  "./utils/*": "./src/utils/*.ts"
}
```

**严禁 `process.cwd()` 算相对路径**：Node 脚本与构建配置必须用 `__dirname`。

```ts
/**
 * 仓库物理路径解析（构建期基础设施单一事实源）
 *
 * 所有脚本与 Vite 配置统一从这里取根目录，禁止用 process.cwd() 推导
 * （桌面快捷方式/CI 工作目录偏移会让相对路径失效，见 AGENTS.md 全局红线 3）。
 */
```

`build/lib/repo-paths.ts` 把这件事收敛成一个函数：`findRepoRoot(__dirname)` 从调用方目录逐级向上找「同时存在 `package.json` 与 `pnpm-workspace.yaml`」的目录，新增脚本不按自身深度手算 `../..`：

```ts
const rootDir = findRepoRoot(__dirname);
```

→ 源码：[build/lib/repo-paths.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/build/lib/repo-paths.ts) · [scripts/verify-prebuild.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/scripts/verify-prebuild.ts)

### 3. 任务路由：先读包规则，再查深档

根 `AGENTS.md` 的任务路由是一张三列表：任务、先读、再查。节选几行（路径相对仓库根目录）：

| 任务 | 先读 | 再查 |
| --- | --- | --- |
| 新增业务域（shared→preload→main→renderer 全链路） | 四包的 AGENTS.md | README「全栈端到端功能开发 SOP」 |
| 模块装配 / 启动流程 / 运行时 | `main/AGENTS.md` | `docs/module-and-runtime-specification.md` |
| renderer 页面 / 卡片 / 请求层 | `renderer/AGENTS.md` | — |
| 日志 / 异常 / 链路追踪 | `.agents/rules/logging-specification.md` | `docs/logging-tracing-and-error-handling-guide.md` · `docs/logging-and-exception-audit.md` |
| 发版流程 / tag / changelogen | 全局红线 | `.github/CICD.md` · `docs/adr/0004` |

这张表把「AI 该读什么」从临场判断变成查表：新增业务域先去读四包 AGENTS.md，模块装配先读 main 的规则，日志问题先读横切规则。表里的「再查」列只给路径，不复制深档内容——规则与解释各留一处。

### 4. 包级铁律：约束落在具体目录上

根文件只给底线，目录级约束住在各包 `AGENTS.md` 里，且都能对应到一个可执行的检查：

- `@app/main`：依赖方向单向 `IPC 事件 → Controller → Service`，Service 严禁感知 IPC；入参必须 `safeParse`；IPC 返回统一 `Result<T>`；所有 handler 经 `handleTraced` 注册，禁止裸写 `ipcMain.handle`
- `@app/preload`：`apiBridge` 显式声明 `ElectronApi`；通道常量从 `@app/shared/constants/ipc-channels` 引入；所有 invoke 经 `invokeTraced`；零业务逻辑
- `@app/renderer`：`entries → features → 跨域层` 单向；feature 之间禁止互相 import（`dashboard` 组合编排例外）；异步请求一律 `useManualRequest`，Biome `noRestrictedImports` 禁止直连 ahooks `useRequest`
- `@app/shared`：Schema 与 `z.infer` 推导类型只在 `schemas/*.ts` 定义；纯返回接口归 `types/`；子路径直出，不设根入口
- `@app/pr-review`：对外命令只在 `src/cli.ts` 与 `src/commands/` 增删；根目录 `pnpm pr-review <command>` 是唯一调用方式；`reviews/` 是运行产物，只读不手改

`@app/renderer` 那条限制可以直接在配置里读到，错误信息本身就是给 AI 的指令：

```json
"ahooks": {
  "message": "禁用直接引用 ahooks useRequest；请求一律使用 src/hooks/useManualRequest.ts",
  "importNames": ["useRequest"]
}
```

### 5. 横切规则：`.agents/rules` 按 globs 触发

不是所有规则都挂在某个包上。`.agents/rules/` 放横切规则，文件头用 globs 声明触发范围；目前一份 `logging-specification.md`，`globs: packages/**/*.{ts,tsx}`，规定落盘日志必须纯英文。根 `AGENTS.md` 只在「指针」与任务路由里引用它，不展开内容。

## 怎么抄

以「给一个已有 monorepo 补 AI 协作者约定」为例，四步：

1. **根文件只放三类内容**：包无关红线（一句话可判定）、包索引、任务路由；常用命令与指针放最后
2. **每包一份 AGENTS.md**：开头声明「本文件是该包规则的唯一真源」并回链根文件，正文写目录结构、依赖方向、铁律、Anti-Patterns、SOP、提交前门禁
3. **每条红线配一个落点**：Biome 规则、`verify-prebuild` 静态检查、lint / typecheck / test 门禁——AI 才能在提交前自检
4. **横切规则单独目录**：用 globs 声明作用范围，根文件只留指针

注意点：

- 根 AGENTS.md 的包索引要如实标注没有规则文件的包（`@app/docs` 一栏是 `—`），否则 AI 会去找不存在的文件
- 规则真源在包 AGENTS.md，README 不承载目录树 / 铁律 / SOP（四份包文件的措辞一致）
- 新增包时把 AGENTS.md 登记进根文件的包索引与任务路由，否则它不会被主动读取
- 红线写成「一句话可判定」，不要写成需要解释的风格偏好
