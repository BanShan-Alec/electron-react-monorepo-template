# 桶文件全禁（一刀切）整改计划

> 目标仓库：`H:\electron-app-temp5`（electron-react-monorepo-template）
> 生成日期：2026-09-22
> 策略决策：**全库禁桶**——`noBarrelFile: "error"` 且**不设任何 overrides 白名单**；配套 `noReExportAll: "error"` 与 `noImportCycles: "error"`。理由：21 个纯桶中 8 个为零消费者死桶、64 处 `export *`、桶套桶成环温床；当前跨 feature 引用为零，边界契约处于"名义存在、实际无人在乎"状态，全禁的真实代价最低。未来确需引入桶时，走文末"再引入流程"。

## 关联规范核验 (Referenced Specs)

- [x] 已自主查阅 [renderer/directory-structure.md](file:///H:/specs-electron-fullstack/renderer/directory-structure.md)：该规范现要求 `features/{name}/index.ts` 为"唯一对外公开导出出口"，**与本计划的全禁策略直接冲突，必须在 Phase 5 反向修订**（从"必须建桶"改为"默认禁止 + 再引入流程"）。
- [x] 已自主查阅 [core/module-system-spec.md](file:///H:/specs-electron-fullstack/core/module-system-spec.md)：main/preload 遵循 CJS（"写 ESM 出 CJS"），CJS 无 tree-shaking，桶在主进程侧是启动期 eager `require` 实成本——这是全禁在主/preload 优先级最高的依据；preload 的 `webUtils` 桥接契约不受本次改动影响。
- [x] 已自主查阅 [core/pnpm-build-setup.md](file:///H:/specs-electron-fullstack/core/pnpm-build-setup.md)：shared 包走 package.json `exports`（现状为源码直出 `.ts`），子路径导出沿用该模式，`moduleResolution: "Bundler"` 下通配目标加 `*.ts` 后缀补齐扩展名，无需改 tsconfig paths。
- [x] 已自主查阅 [core/typescript.md](file:///H:/specs-electron-fullstack/core/typescript.md)：`verbatimModuleSyntax: true`（renderer tsconfig.app.json 已开），重写 import 时类型必须显式 `import type`，与 `noReExportAll` 生效后的 `export type { }` 写法对齐。
- [x] 已自主查阅 [renderer/ipc-consumption.md](file:///H:/specs-electron-fullstack/renderer/ipc-consumption.md)：preload/src/index.ts 是入口本体（apiBridge + contextBridge），**不在删除范围**，仅重写其 `@app/shared` 导入路径。
- [x] 外部依据：[Biome noBarrelFile](https://biomejs.dev/linter/rules/no-barrel-file/)、[noReExportAll](https://biomejs.dev/linter/rules/no-re-export-all/)、[noImportCycles](https://biomejs.dev/linter/rules/no-import-cycles/)、[The barrel file debacle](https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/)（删无消费者桶后 dev/test/lint 建图加速 60–80% 的实测区间）。

## 现状盘点（已 grep 核实）

23 个 `index.ts` 外加 1 个 `index.module.ts`，其中 **21 个为纯重导出桶，全部删除**；3 个保留（非桶）：

| 文件 | 处置 | 原因 |
| :--- | :--- | :--- |
| `packages/renderer/src/features/*/index.ts` ×7 | **删** | 唯一消费者 App.tsx；`export * from './hooks'` 为桶套桶 |
| `packages/renderer/src/features/*/hooks/index.ts` ×7 | **删** | 纯转发层，唯一消费者是自家根桶 |
| `packages/renderer/src/components/ui/index.ts` | **删** | 4 条 `export *`；9 个消费方改直达 |
| `packages/renderer/src/components/layout/index.ts` | **删** | 单文件桶（仅 Header） |
| `packages/shared/src/{index,constants/index,schemas/index,types/index}.ts` | **删** | 三层嵌套 `export *` 共 18 处 |
| `packages/main/src/modules/index.ts` | **删** | 10 条 `export *`，**零消费者**；CJS eager require |
| `packages/main/src/modules/security/index.module.ts` | **删** | 纯桶（3 条 `export *`）；消费者 `main/src/index.ts` 改按符号来源直达 `external-urls` / `block-origins` |
| `packages/preload/src/index.ts` | 保留 | 入口本体（apiBridge 定义） |
| `packages/main/src/index.ts` | 保留入口 | 删其顶部 `export { getAppConfigStore, getLogManager, WindowStateKeeper }`（零消费者，且会诱发 initApp 自举副作用） |
| `packages/main/src/controllers/index.ts` | 保留 | 装配点（含 `registerAllControllers` 逻辑），非纯重导出，规则不命中 |

已确认的附带问题：`ArchitectureView.tsx:97` 的 `import type { AppRouter } from '@app/main/router'` —— `packages/main/src/router.ts` 不存在且 main 的 exports 仅 `"."`，为**坏引用**（兼犯 renderer-no-main 红线），随 Phase 1 修复。

## Phase 0：基线确认（不改代码）

1. 建分支 `git checkout -b chore/ban-barrel-files`。
2. 记录基线：`pnpm typecheck && pnpm lint && pnpm build`，三者须 Exit 0；不绿先修绿再动结构。
3. 基线留证：`find packages -name index.ts -not -path '*/node_modules/*' | wc -l` → 23；`grep -rn "export \*" packages --include='*.ts' --include='*.tsx' | wc -l` → 64（main 13 / renderer 33 / shared 18）。

## Phase 1：shared 去桶化 + 子路径导出 + AppRouter 修复

1. `packages/shared/package.json` exports 改为：
   ```json
   "exports": {
     "./constants/*": "./src/constants/*.ts",
     "./schemas/*": "./src/schemas/*.ts",
     "./types/*": "./src/types/*.ts"
   }
   ```
   （删除 `"."`；通配目标带 `*.ts` 后缀，import 方仍写无扩展名路径，Bundler 解析直接命中，无扩展名猜测）
2. 删除 4 个 index.ts：`shared/src/index.ts`、`constants/index.ts`、`schemas/index.ts`、`types/index.ts`。
3. 重写全部 17 个 `@app/shared` 消费方（7 controllers + config.module + 7 services + preload + env.d.ts）：值从子路径导入（`@app/shared/schemas/calculator`、`@app/shared/constants/ipc-channels`、`@app/shared/constants/error-codes`），类型从 `@app/shared/types/*` 导入并显式 `import type`（`verbatimModuleSyntax`）。
4. preload 的运行时依赖收敛为仅 `constants/ipc-channels`（现状会经根桶把 schemas→zod 拖进 CJS require 链）。
5. ~~新增 `packages/shared/src/types/router.ts` 定义 `AppRouter`；`ArchitectureView.tsx` 改从 `@app/shared/types/router` 导入~~ **【取消】**：执行前复核时发现，`ArchitectureView.tsx` 中的 `@app/main/router` 是组件内展示“反例”的模板字符串文本（第 97 行的代码块演示），并非真实 import——既无坏引用，也无越包引用，无需处理。
6. **验证**：`pnpm typecheck` Exit 0。

## Phase 2：renderer 去桶化

1. 删除 16 个桶（7 根桶 + 7 hooks 桶 + ui + layout）。
2. `App.tsx` 改为直达导入：`Header` ← `./components/layout/Header`；每个 feature 2 条——组件 `./features/x/components/XCard`（或 `/components/XView`）、hook `./features/x/hooks/useX`（约 8 行扩为 20 行）。
3. 9 个 ui 消费方（`CalculatorCard/CounterCard/LoggingCard/DevToolsCard/DialogCard/SettingsCard/SystemInfoCard/PingCard/ArchitectureView`）将 `import { Button, Card } from '../../../components/ui'` 拆为对 `../../../components/ui/{Button,Card,...}` 的具体文件导入；`Header.tsx` 的 `Badge` 同理。
4. 沿用仓内既有风格：features 内无扩展名、App.tsx 自带 `.tsx` 扩展名，均保留，不强求统一（`useImportExtensions` 非 recommended，不启用）。
5. **验证**：`pnpm typecheck` Exit 0。

## Phase 3：main 清理

1. 删除 `packages/main/src/modules/index.ts`（零消费者）与 `packages/main/src/modules/security/index.module.ts`（纯桶）。
2. `packages/main/src/index.ts`：删除 `export { getAppConfigStore, getLogManager, WindowStateKeeper };`；将 `from './modules/security/index.module'` 的两个符号改为按来源直达 `'./modules/security/external-urls'` / `'./modules/security/block-origins'`（由 typecheck 验证符号归属）。
3. `packages/main/src/modules/ipc.module.ts`：`'../controllers/index'` → `'../controllers'`。
4. **验证**：`pnpm typecheck` Exit 0。

## Phase 4：规则全开 + 门禁

1. `.config/biome.json` 的 `linter.rules` 增加（**不加 overrides**）：
   ```json
   "performance": { "noBarrelFile": "error", "noReExportAll": "error" },
   "suspicious": { "noImportCycles": "error" }
   ```
2. 明确**不纳入**的规则及原因：`noCommonJs`——main 入口按 module-system-spec 使用 `require.resolve` 标准 CJS 寻址，会误伤；`noNamespaceImport`——与 `single-instance.module.ts` 的 `import type * as Electron` 冲突，需另行评估。
3. **风险预案**：`noImportCycles` 为首个全新增量规则，可能暴露既有循环（如 window/tray/log 模块间互引）。若报既有 cycle：逐个评估修复，这些本就是规范要求的隐患；确需临时放行的用 suppression 注释并登记 docs/TODO.md，不得静默关闭规则。
4. **验证**：`pnpm typecheck && pnpm lint && pnpm build` 三者 Exit 0；`find packages -name index.ts -not -path '*/node_modules/*' | wc -l` → 3；`grep -rn "export \*" packages --include='*.ts'` → 0。
5. 冒烟（人工）：`pnpm start` 启动应用，确认界面、IPC 调用（counter/calculator/dialog/config）正常。

## Phase 5：文档与再引入流程

1. 反向修订 [specs-electron-fullstack/renderer/directory-structure.md](file:///H:/specs-electron-fullstack/renderer/directory-structure.md)：删除/改写"唯一对外公开导出出口（Public API）"条款，改为"默认禁止桶文件；跨模块一律直达具体文件；确需引入须走豁免评审"。
2. 在 `docs/` 新增本计划的落地记录，并写明**桶文件再引入流程**（将来唯一合法路径）：
   - 提案人说明该桶的边界价值与消费方清单；
   - 经评审后在 `.config/biome.json` 增加**命名明确的单条 override**（如 `includes: ["packages/renderer/src/features/*/index.ts"]`，禁止宽泛 glob），禁用该文件的 `noBarrelFile`；
   - 桶内必须显式命名重导出具体文件（`noReExportAll` 保持全局生效），禁止桶套桶、禁止 `export *`；
   - 在 docs/TODO.md 登记豁免条目与复审日期。
3. CONTRIBUTING.md 补一条桶文件禁令的链接。

## 验收标准汇总

- [ ] 除 3 个保留文件（`preload/src/index.ts`、`main/src/index.ts`、`main/src/controllers/index.ts`）外无任何桶文件；`export *` 归零。
- [ ] `pnpm typecheck && pnpm lint && pnpm build` Exit 0（含三条新 ERROR 规则）。
- [ ] 坏引用 `@app/main/router` 消除；AppRouter 迁至 `@app/shared/types/router`。
- [ ] 每 Phase 一个独立 commit，分支 `chore/ban-barrel-files`，可整体 revert。
- [ ] specs 仓库规范反向修订完成，规则、代码、规范三处一致。

## 工作量与风险

改动集中在 4 个提交：shared（约 18 文件）、renderer（约 11 文件）、main（3 文件 + 删 2 桶）、配置（1 文件）。最大风险是漏改 import，由 `pnpm typecheck` 全包类型检查兜底；次风险是 `noImportCycles` 暴露既有循环（预案见 Phase 4）；全部为可静态验证的结构改动，无运行时行为变化（除 preload 加载图瘦身）。

---

## 落地记录（2026-09-22 执行完毕）

**分支**：`chore/ban-barrel-files`，共 4 个提交：

| 提交 | 内容 |
| :--- | :--- |
| `7ec0171` | shared 去桶化：删 4 个 index.ts，package.json 改子路径 exports（`./constants/*`、`./schemas/*`、`./types/*`），17 个消费方 + `types/api.ts` 内部导入全部直达 |
| `74d72f1` | renderer 去桶化：删 16 桶，App.tsx 8 条 barrel 导入展开为直达，9 个 ui 消费方与 Header.tsx 改具体文件导入 |
| `7e7c86f` | main 清理：删 `modules/index.ts`（零消费者）与 `security/index.module.ts`，删入口 3 个零消费者再导出，security 与 controllers 改直达 |
| `45f2ddb` | `.config/biome.json` 开启 `noBarrelFile/noReExportAll/noImportCycles` 三条 error，清理重写过程引入的 2 处冗余导入 |

**验收结果**：
- `pnpm typecheck` ✅ 全 5 包通过；`pnpm lint` ✅ 0 告警（三条新规则 error 级生效）；`pnpm build` ✅ 全包通过。
- 结构核验：`index.ts` 残留恰好 3 个（`preload/src/index.ts` 入口本体、`main/src/index.ts` 入口本体、`main/src/controllers/index.ts` 装配点，均非纯重导出）；全库 `export *` 归零（基线 64 处）。
- 产物对比（改造前 → 改造后）：renderer JS 251,486 B → 251,486 B；main `index.cjs` 984.81 kB → 986.55 kB（噪声级）。**产物体积基本不变，符合调研结论**——桶的成本在 dev/test 的模块图建图，而非生产包体积。
- `noImportCycles` 启用后未暴露既有循环。

**遗留事项**：Electron GUI 冒烟（`pnpm start` 验证界面与 IPC）未在本环境执行，需接管人在桌面环境补做一次。

**Phase 5 完成项**：specs-electron-fullstack 仓库 [renderer/directory-structure.md](file:///H:/specs-electron-fullstack/renderer/directory-structure.md) 已反向修订（废止“index.ts 唯一公开出口”，改为默认禁止 + 再引入流程）；本仓 CONTRIBUTING.md 已补禁令条款与流程链接。
