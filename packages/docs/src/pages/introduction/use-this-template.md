---

title: 使用此模板（Use-this-template）
description: 把模板转为自己项目的七组原子任务，可整页交给 AI 协作者执行，每个任务自带同步挂载点与机器可查的完成判据。
---

# 使用此模板（Use-this-template）

> **TL;DR**：Use this template / Fork 之后、写第一行业务之前，按 §2 七组原子任务完成「转为己有」；每个任务自带同步挂载点与完成判据，可整页交给 AI 协作者执行，人只验收判据。

## 1. 执行时机与前置条件

- **何时执行**：GitHub「Use this template」/ Fork / Clone 之后、写第一行业务之前。此时全部挂载点保持模板默认形态，改造成本最低。
- **边界**：把仓库跑起来见 [快速上手（Getting Started）](/introduction/getting-started)；`name` / `appId` / `productName` 等字段逐项含义见 [配置项归属](/dx/configuration-map)，本页只给动作与判据。
- **执行方式**：整页投喂 AI 协作者逐任务执行，或人工照做；「判据」均为机器可查命令，逐条验收后再进入下一任务。

## 2. 核心机制

### 任务 1：身份与仓库坐标改名

全仓身份由根 `package.json` 单一真源解析（[build/lib/app-identity.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/build/lib/app-identity.ts) 消费），改这六处即贯通 electron-builder 发布坐标、主进程 GitHub 坐标与窗口标题：

→ 源码：[package.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/package.json)
```jsonc
{
  "name": "electron-react-monorepo-template", // [!code --]
  "productName": "Electron React Template", // [!code --]
  "appId": "com.template.electron-react-monorepo", // [!code --]
  "description": "Type-safe Electron monorepo template powered by Vite, React and ContextBridge IPC", // [!code --]
  "author": {
    "name": "BanShan-Alec", // [!code --]
    "email": "627649674@qq.com" // [!code --]
  },
  "repository": {
    "url": "https://github.com/BanShan-Alec/electron-react-monorepo-template.git" // [!code --]
  }
}
```

- **判据**：`pnpm verify:prebuild` 绿（`name` 小写规约由该门禁校验）；`productName` 触发 §3 的 userData 高危项，发布后不可再改。

### 任务 2：品牌资源替换

- 替换 `build/resources/icon.{ico,png,icns}`（安装器与窗口图标）、`packages/renderer/src/assets/logo.svg` + `logo-compact.svg`（界面 logo 家族）、`packages/renderer/public/favicon.svg`（与 logo-compact 同 path 家族）。
- **判据**：`pnpm build:unpack` 产物窗口 / 任务栏 / 安装器图标正确；Header 与首屏 logo 渲染无变形。

### 任务 3：裁剪演示业务域（counter / calculator）

两个演示域严格穿透 4 层契约链路（shared → preload → main → renderer），按链路成对剔除：

→ 源码：[packages/main/src/controllers/index.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/controllers/index.ts)
```ts
// 节选：主进程集中注册点——删两行注册，同步删文件顶部对应 import
export function registerAllControllers(): void {
  registerSystemControllers();
  registerUsbControllers();
  registerCounterControllers(); // [!code --]
  registerCalculatorControllers(); // [!code --]
  registerConfigControllers();
  registerDiagnosticsControllers();
  registerDialogControllers();
  registerUpdaterControllers();
  registerWindowControllers();
}
```

- **shared**：删 `src/schemas/counter.ts` 与 `calculator.ts`；删 `src/constants/ipc-channels.ts` 的 `COUNTER_*` / `CALCULATOR_*` 枚举；删 `src/types/api.ts` 的 `counter` / `calculator` 接口块。
- **preload**：删 `src/index.ts` 中 `counter` / `calculator` 两段桥接转发。
- **main**：删 `controllers/` 与 `services/` 下四个对应文件及上面两行注册。
- **renderer**：删 `features/counter/` 与 `features/calculator/` 目录；删 `features/dashboard/index.tsx` 中两张卡片。
- **测试连坐**：`e2e/telemetry.spec.ts` 与 `e2e/feature-interactions.spec.ts` 以两域为遥测载体、`e2e/settings.spec.ts` 以 Counter 卡片做多语言断言，需改写载体或删除断言。
- **判据**：`pnpm typecheck && pnpm lint && pnpm test` 全绿；`pnpm test:e2e` 相关用例已改写。

### 任务 4：剥离文档站（可选）

`packages/docs` 为可选外壳，剥离需成对清理：

→ 源码：[tsconfig.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/tsconfig.json)
```jsonc
{
  "references": [
    { "path": "./packages/main" },
    { "path": "./packages/preload" },
    { "path": "./packages/renderer" },
    { "path": "./packages/shared" },
    { "path": "./packages/pr-review" },
    { "path": "./packages/docs" }, // [!code --]
    { "path": "./scripts" },
    { "path": "./build" },
    { "path": "./e2e" }
  ]
}
```

- 删 `packages/docs/` 目录；根 `package.json` 删 `docs:dev` / `docs:build` 脚本；删 `.github/workflows/docs-deploy.yml`；根 `AGENTS.md` 删包索引 `@app/docs` 行与 §5「文档站内容变动」行。
- **内嵌文档 Tab**（不需要则一并删）：`features/docs/` 目录、`entries/home/App.tsx` 的 import 与 `/docs` keep-alive 分支、`components/layout/Header/index.tsx` 的「文档站」导航项；主进程连坐删 `modules/window/docs-embed.ts`、`docs-embed-policy.ts` 及对应单测。
- 保留 Tab 只换站点：仅改 `packages/shared/src/constants/docs.ts` 的 `PROJECT_DOCS_URL`——该常量另被 DevTools「打开文档站」按钮与主进程外链白名单消费，剥离 Tab 时也应保留。
- **判据**：`pnpm typecheck && pnpm lint` 绿；`docs:*` 命令不存在为预期。

### 任务 5：pr-review 工具链去留

- **保留**：零改码，仓库 Settings → Actions secrets 配置 `OCR_LLM_URL` / `OCR_LLM_TOKEN` / `OCR_LLM_MODEL` 三枚密钥即启用 PR 自动评审。
- **移除**：删 `.github/workflows/open-code-review.yml`、`packages/pr-review/` 整包、根 `package.json` 的 `pr-review` / `test:pr-review` 脚本、根 `AGENTS.md` 五处提及（包索引 / 任务路由 / 门禁矩阵两行 / §7 ESM 约定）、`.agents/skills/pr-review/` 目录与 CONTRIBUTING §四命令表。
- **判据**：`pnpm install && pnpm typecheck` 绿；推送后 CI 其余 job 全绿。

### 任务 6：发布坐标残留核对

`release.yml` 与 `open-code-review.yml` 均经 `github.repository` / secrets 取坐标，fork **零改动**；真正残留只有三处：

- `README.md`：CI 徽章与九维度入口等 6 处模板仓库链接。
- `packages/shared/src/constants/docs.ts` 的 `PROJECT_DOCS_URL`（见任务 4）。
- `packages/docs/src/navigation.ts` 的 `BASE_PATH`（保留文档站时改）。
- **判据**：`grep -ri "banshan-alec" --exclude-dir=node_modules --exclude-dir=dist` 仅剩文档站页内的 GitHub 直链与 CHANGELOG 历史节（任务 7 清零）。

### 任务 7：版本史清零

- 删根 `CHANGELOG.md`（changelogen 发版时重建）；`git push origin --delete` 全部 `v*` tag；GitHub Releases 页删全部历史 Release。
- 按 [发版流水线（Changelogen）](/delivery/release-pipeline) 从首个版本重新起步。
- **判据**：新 tag 推送后 GitHub Release 正常生成，三平台产物齐全。

## 3. 桌面端避坑注意事项

| 避坑要点                 | 事故表现                                                                               | 对齐方案                                                                                    |
| :----------------------- | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| **productName 高危变更** | `productName` 决定操作系统 `userData` 目录路径，改后旧版本持久化数据与日志不会自动迁移 | 见 [配置项归属](/dx/configuration-map)；确需变更时主进程显式 `app.setPath('userData', ...)` |
| **漏改 tsconfig 引用**   | 删包未删根 `references` 节点，`pnpm typecheck` 抛 `TS6053` 阻断 CI                     | 每删一个包，同步删根 `tsconfig.json` 对应节点                                               |
| **Controller 悬挂注册**  | 删 controller 文件漏改注册表，构建期抛模块未找到                                       | 在 `registerAllControllers()` 集中注册处成对清理                                            |
| **契约单向残缺**         | 只删渲染层卡片不删 `@app/shared` 契约，死类型混入产物                                  | 按 shared → preload → main → renderer 链路成对剔除                                          |
