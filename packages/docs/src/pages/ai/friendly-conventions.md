---

title: AI 产出验收清单（Review-checklist）
description: 交付或审查 AI 生成代码前的机器门禁命令、架构边界核对表与高频越界排查清单。
---

# AI 产出验收清单（Review-checklist）

> **TL;DR**：AI 写出可编译的代码不等于符合本仓库架构。提交前先跑通根 `AGENTS.md` 门禁矩阵，再按本清单逐项核对「机器无法自动判定」的跨端边界、React 组件顺序与豁免条款。

**边界声明**：本页负责 AI 生成代码提交前的双层验收核对；不负责规则分层原理（见 [与 AI 协作](/introduction/ai-collaboration)）、全栈四步编码顺序（见 [全栈端到端功能开发](/ai/fullstack-sop)）或 PR 工具链命令（见 [AI 评审闭环](/ai/review-loop)）。

## 1. 机器门禁必跑清单

AI 改动完任何代码后，必须按改动范围执行对应校验命令，并如实报告结果：

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm verify:prebuild
```

| 改动范围                | 追加必跑命令                                 | 拦截目标与说明                                                                 |
| :---------------------- | :------------------------------------------- | :----------------------------------------------------------------------------- |
| 任意 TS / TSX / MD 改动 | `pnpm typecheck && pnpm lint`                | 跨包类型、`noBarrelFile`、`noReExportAll`、`useReactCompiler` 与格式统一校验   |
| 渲染层文案或 `t\`...\`` | `pnpm i18n:extract` 补译后 `pnpm i18n:check` | 抽取中文词条并验证 `en-US/messages.po` 无缺译                                  |
| `packages/pr-review`    | `pnpm test:pr-review`                        | 根 `pnpm test` 刻意排除了该包，必须单独执行                                    |
| 依赖、样式令牌或主进程  | `pnpm verify:prebuild`                       | 校验根 `name` 正则、根 `dependencies` 白名单（仅 `@app/main`）与渲染层颜色字号 |
| 跨端交互或打包行为      | `pnpm test:e2e:build`                        | 构建三包并用 Playwright 拉起真实 Electron 窗口回归                             |

## 2. 跨端架构与契约核查

- **契约唯一真源（`@app/shared`）**：入参校验模型与导出类型必须从 Zod `z.infer` 就近派生，禁止在 `types/` 手写第二份入参类型；严格按子路径直出导入，禁止新增只做重导出的 `index.ts` 或 `export *`（规则真源见 [packages/shared/AGENTS.md](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/AGENTS.md)）。

→ 源码：[packages/shared/src/schemas/close-behavior.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/schemas/close-behavior.ts)
```ts
import { z } from 'zod';

export const closeBehaviorChoiceSchema = z.enum(['window', 'quit', 'cancel']);
export type CloseBehaviorChoice = z.infer<typeof closeBehaviorChoiceSchema>;
```

- **安全桥接（`@app/preload`）**：`apiBridge` 必须显式标注为 `ElectronApi`；所有调用走 `invokeTraced`，禁止裸调 `ipcRenderer.invoke` 或在模块顶层缓存启动快照 Promise；新增推送通道需明确粘性（`createStickyChannel`）或瞬态（返回取消函数），见 [packages/preload/AGENTS.md](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/preload/AGENTS.md)。
- **主进程分层（`@app/main`）**：Service 保持纯业务逻辑、零 `ipcMain` 感知；Controller 经 `handleTraced` 注册、入参用 `.safeParse` 校验、异常经 `catchToResult` 统一返回 `Result<T>` 并在 `controllers/index.ts` 集中挂载（唯一追踪豁免为 `IPC_CHANNELS.DIAGNOSTICS_LOG`），见 [packages/main/AGENTS.md](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/AGENTS.md)。

## 3. 渲染层与提交规范核查

对照 [packages/renderer/AGENTS.md](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/AGENTS.md) §5–6 与 [React 组件编写规范](/architecture/react-conventions) 逐项排查：

- **Feature 边界与请求纪律**：外部只能从 `features/<domain>/index.tsx` 导入入口组件；异步通信必须通过 `useIpc('domain.method')` 或 `useManualRequest`（强制 `manual: true`），严禁在组件内裸写 `window.api.*` 解构；仅 `useManualRequest.ts` 本身在 Biome 配置中获得 `noRestrictedImports` 豁免。
- **组件结构与七段式顺序**：组件采用一组件一文件夹 `Xxx/index.tsx`、具名 `export interface XxxProps` 与 `export const Xxx = memo(_Xxx)`；函数体严格保持「解构 ➔ State ➔ IO ➔ 派生 ➔ Handlers ➔ Effect ➔ JSX」单向顺序，不倒置；常量与纯函数提取至组件外部。
- **React Compiler 与 Ant Design 优先**：禁止 AI 机械套用样板式 `useMemo` / `useCallback`，严禁在 render 期读写 `ref.current`；优先复用 Ant Design 与仓库封装组件（状态点用 `<Badge>`、标签用 `<StatusTag>`、按钮加载用 `<Button loading>`），无边框拖拽区上方浮层根节点须挂 `.no-drag`。
- **提交信息含简体中文**：Commit subject 必须含简体中文且匹配 Conventional Commits 类型枚举（见 [提交信息规范](/engineering/commit-convention)）。

→ 源码：[.config/commitlint.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.config/commitlint.config.ts)（节选）
```ts
const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'subject-chinese': (parsed) => {
          const { subject } = parsed;
          if (!subject) {
            return [false, '提交说明（subject）不能为空'];
          }
          const hasChinese = /[\u4e00-\u9fa5]/.test(subject);
          return [
            hasChinese,
            '提交说明（subject）必须包含简体中文描述，例如: feat: 增加系统托盘功能',
          ];
        },
      },
    },
  ],
  rules: {
    'subject-chinese': [RuleConfigSeverity.Error, 'always'],
    'subject-case': [RuleConfigSeverity.Disabled],
  },
};
```

## 4. 工程红线与文档同步核查

- **根目录依赖与配置归属**：根 `package.json` 的 `dependencies` 仅允许 `@app/main`；跨包工具配置必须落在 `.config/` 与根 `devDependencies`，包专属配置进对应包目录，禁止把 `*.config.*` 散放在根目录。
- **Node 隔离与路径推导**：渲染层源码禁止引入 `node:fs`、`__dirname` 或 `process`（`tsconfig` 仅凭约定隔离）；Node 脚本与构建配置须通过 `findRepoRoot()` 或 `import.meta.dirname` 推导路径，不依赖 `process.cwd()`。
- **文档与代码同 PR 同步**：凡新增或删除目录、模块、导出、脚本或依赖，必须在同一 PR 内更新对应包的 `AGENTS.md`（若触及文档站页面或路径，则同步更新 `packages/docs/src/navigation.ts`）。
