# 窗口状态持久化切换至官方 windowStatePersistence 暨 Electron 41 → 45 升级规划

> 状态：待执行 · v3 · 2026-10-23
>
> 前置评估结论：官方能力可用，但要求 Electron ≥ 44.0.0，且该 API 至 45.0.0 仍标记 `_Experimental_`。

## 1. 目标和完成标准

1. **功能 1：Electron 41.0.3 → 45.0.0 纯升级（行为不变）**
   - 标准 1.1：`package.json` 的 `electron` 精确锁定 `45.0.0`；lockfile 同步；`pnpm.onlyBuiltDependencies` 移除失效的 `electron` 条目。
   - 标准 1.2：`pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build && pnpm test:e2e` 全绿。
   - 标准 1.3：`pnpm build:dir` 成功；asar 体积与文件数与升级前基线相比无数量级劣化；`usb` 的 `.node` 仍被 `asarUnpack` 正确解包。
   - 标准 1.4：Windows 上 `pnpm start`、`pnpm start:dist`、`dist/win-unpacked/*.exe` 三态冒烟通过（窗口、WCO 标题栏、托盘、USB 设备列表）。
   - 标准 1.5：文档中的 Electron 版本口径全部更新为 45（根 `AGENTS.md`、`README.md`、`docs/wco-native-titlebar-integration.md`）。

2. **功能 2：主窗口状态持久化改用 Electron 官方 `windowStatePersistence`**
   - 标准 2.1：删除自维护的 `WindowStateKeeper`（191 行）及其事件监听/防抖/磁盘写入逻辑。
   - 标准 2.2：主窗口以 `name: WINDOW_IDS.HOME` + `windowStatePersistence: true` 创建（bounds/displayMode 均默认 `true`）；首次启动仍由现有 `resolveWindowBounds` 计算自适应尺寸与居中。
   - 标准 2.3：**不做旧状态兼容**：不读取 `window-state.json`；升级后首次启动按默认自适应尺寸居中，release notes 明确标注 breaking change。
   - 标准 2.4：新增 e2e 覆盖“同一 `--user-data-dir` 重启后 bounds 恢复”；Linux/Xvfb 下只断言 bounds，不断言最大化。
   - 标准 2.5：窗口状态存储位置、重置方式（`BrowserWindow.clearPersistedState('home')`）在 `docs/configuration-guide.md` 有说明。

3. **交付方式**
   - 标准 3.1：拆成两个 PR（升级 / 重构），各自独立可回滚，均 squash 合并。
   - 标准 3.2：每个 PR 的 4 个 required checks（typecheck / lint / test / e2e）全绿。

## 2. 背景与约束

### 2.1 已核实的事实（不可凭文档页面臆断）

- `windowStatePersistence`、`BaseWindow.clearPersistedState()`、`persisted-state-restored` 在发布版类型定义中的出现次数：
  - Electron 41.0.3：0；43.0.0：0；**44.0.0：5**；45.0.0：5。
- `base-window-options.md` 中该选项在 44/45 均标注 `_Experimental_`。
- 官方实现写入 Chromium `local_state`（`userData/Local State`，pref key `windowStates`），不再使用 `window-state.json`。
- 官方保存策略（v44 与 v45 源码一致）：200ms 防抖；`OnWindowClosed` 时 flush；退出时 `CommitPendingWrite`；无有效显示器时自动禁用。
- 官方恢复发生在窗口构造过程中（`RestoreWindowState` 位于 `NativeWindow` 构造、min/max 约束之后、`Show()` 之前），因此比现有“构造后手动 maximize”更不易出现尺寸跳变。
- 官方**不提供**首屏自适应尺寸/居中，首次启动仍取决于构造参数。

### 2.2 运行时跨度

| | 41.0.3（现状） | 45.0.0（目标） |
| --- | --- | --- |
| Chromium | 146.0.7680.80 | 156.0.8078.48 |
| Node | 24.14.0 | 24.22.0 |
| V8 | 14.6 | 15.6 |
| 发布日期 | 2026-03-17 | 2026-10-21 |

### 2.3 仓库约束

- 根目录禁增业务依赖；包级规则见各 `packages/*/AGENTS.md`。
- 禁止桶文件；不新增只做重导出的 `index.ts`。
- Node ESM/CJS 与路径基准沿用现有构建体系，不引入 `process.cwd()`。
- Electron 版本当前为精确锁定（无 `^`），继续保持精确锁定，避免实验性 API 随 minor 漂移。

## 3. 方案与关键决策

- **D1 目标版本选 45.0.0，而不是 44.x。** 45 的三条主要破坏性变更（sandboxed preload 移除 Node shim / 原生 EventEmitter / ASAR fd）经核对均不影响本仓库；且 45 的支持窗口最长。
- **D2 两个 PR 串行。** PR-A 只升级；PR-B 只改窗口状态。这样若实验性 API 出问题，回滚面仅限 PR-B。
- **D3 `displayMode: true`，接受 fullscreen/kiosk 也恢复。** 官方不支持“只恢复最大化”。这是相对现状的行为增强，需写入 release notes。
- **D4 保留 `window-size.ts`。** `resolveWindowBounds` / `calculateAdaptiveInitialSize` / `calculateCenteredCoordinates` 转为“首次启动默认值计算”职责，单测保留。
- **D5 旧状态直接断代，不做兼容。** 不读取、不迁移、不自动删除 `window-state.json`；升级后首次启动窗口位置/尺寸/最大化状态重置为默认值，作为 breaking change 写入 release notes 与配置指南。旧文件留在用户目录无害，文档注明可手动删除。
- **D6 不在本计划内做“恢复默认窗口布局”UI。** `clearPersistedState` 能力记录为后续可选项。
- **D7 不在本计划内升级 `@sentry/electron`。** 其声明支持 Electron ≥23，保持 8.1.0；若升级后 e2e 出现 preload 异常再单独评估。

## 4. 改动清单与影响面

### 4.1 PR-A：Electron 升级

| 文件 | 改动 |
| --- | --- |
| `package.json` | `electron: 41.0.3 → 45.0.0`；删除 `pnpm.onlyBuiltDependencies` 中的 `electron` |
| `pnpm-lock.yaml` | 由安装命令生成 |
| `.github/workflows/ci.yml` | e2e job 在 `setup-env` 后加 `pnpm exec electron --version` 预热（42+ 惰性下载，提前暴露网络失败）；可选加 `~/.cache/electron` 缓存 |
| `AGENTS.md` | 技术栈行 `Electron 41` → `Electron 45` |
| `README.md` | 首行技术栈 `Electron 41` → `Electron 45` |
| `docs/wco-native-titlebar-integration.md` | 3 处 Electron 41 口径 → 45 |

### 4.2 PR-B：窗口状态重构

| 文件 | 改动 |
| --- | --- |
| `packages/main/src/modules/window/window-state-keeper.ts` | **删除** |
| `packages/main/src/modules/window/window-size.ts` | 承接 `WindowState` 接口定义（原在 keeper）；纯函数逻辑不变 |
| `packages/main/src/modules/window/index.module.ts` | 构造参数加 `name: WINDOW_IDS.HOME` + `windowStatePersistence: this.keepState`；首启默认值统一走 `resolveWindowBounds(null, primaryDisplay)`；删除 keeper 字段、`validateWithDisplays`、`track`、手动 `maximize()`、`DEFAULT_WINDOW_STATE` 分支与底部导出 |
| `packages/main/tests/unit/window-size.test.ts` | 保留；补一条 `resolveWindowBounds(null, display)` 的首启默认值断言 |
| `e2e/helpers/electron.ts` | `LaunchElectronOptions` 增加 `userDataDir?`、`cleanupUserData?`，支持复用目录 |
| `e2e/window-state.spec.ts` | 保留首次启动几何断言；新增“同目录重启后 bounds 恢复”（Linux 不断言最大化） |
| `docs/configuration-guide.md` | 第 185 行用户数据清单改为 `Local State`；补充状态位置与重置方式 |
| `packages/main/AGENTS.md` | 目录树 `window/` 描述改为官方持久化 |
| `.gitignore` | 移除 `window-state.json` 条目（断代后不再产生） |

### 4.3 影响面四行

- 会改：主进程 window 模块、e2e 启动器与窗口状态用例、CI e2e job、3 处版本文档、配置指南。
- 新增：e2e 复用 userData 的能力与 bounds 恢复用例；无新增主进程模块。
- 删除：`window-state-keeper.ts`、`window-state.json` 持久化路径、`DEFAULT_WINDOW_STATE` 分支。
- 对外行为（BREAKING）：窗口状态改存 `Local State`；升级后首次启动窗口位置/尺寸/最大化状态重置为默认；fullscreen/kiosk 也会恢复。

## 5. 步骤

### PR-A（升级，行为不变）

1. 从 `main` 拉 `chore/electron-45` 分支。
2. `pnpm add -D electron@45.0.0`，确认 `package.json` 仍为精确版本；从 `onlyBuiltDependencies` 删除 `electron`。
3. 本地门禁：`pnpm typecheck && pnpm lint && pnpm test`。
4. `pnpm build && pnpm test:e2e`（必须先构建，e2e 加载 dist）。
5. `pnpm build:dir`；记录 asar 体积/文件数；确认 `usb` 的 `.node` 在 `app.asar.unpacked`。
6. Windows 冒烟：`pnpm start`、`pnpm start:dist`、`dist/win-unpacked` 可执行文件；重点看 WCO 标题栏、托盘关闭、USB 设备列表、updater 窗口。
7. 更新 3 处版本文档；CI e2e job 加预热步骤。
8. 推分支开 PR；4 个 required checks 全绿后 squash 合并。
9. 合并后 `gh workflow run "Release App" --ref main` 做三平台构建 dry run（tag 守卫保证不发布）。

### PR-B（重构）

1. 从 `main` 拉 `refactor/window-state-persistence` 分支。
2. 将 `WindowState` 接口移入 `window-size.ts`；确认仓库内不再有旧文件读取/迁移代码。
3. 改写 `index.module.ts` 的 `createWindow`：
   ```ts
   const initial = resolveWindowBounds(null, screen.getPrimaryDisplay());

   const browserWindow = new BrowserWindow({
     name: WINDOW_IDS.HOME,
     windowStatePersistence: this.keepState,
     x: initial.x,
     y: initial.y,
     width: initial.width,
     height: initial.height,
     // ...其余参数不变
   });

   // 官方恢复发生在构造期，删除原 savedState.isMaximized 手动 maximize
   ```
4. 监听 `persisted-state-restored` 写一条 info 日志（沿用 `getLogManager()`，不新增模块）。
5. 删除 `window-state-keeper.ts` 与 `track/validateWithDisplays` 调用；清理 `DEFAULT_WINDOW_STATE` 分支与底部导出。
6. 扩展 e2e 启动器支持复用 `userDataDir`，新增恢复用例：启动 → `electronApp.evaluate` 设置 bounds(900×620 @ 120,90) → `electronApp.close()` → 同目录重启 → 断言 `getNormalBounds()` 匹配（容差 2px）。最大化恢复只在 Windows 手工验证，Linux/Xvfb 跳过。
7. 更新 `docs/configuration-guide.md`、`packages/main/AGENTS.md`、`.gitignore`。
8. 本地门禁同上；额外手工验证：全新 userData 首启居中、移动/缩放后重启恢复、最大化后重启恢复、`clearPersistedState('home')` 后回到默认。
9. 开 PR，4 checks 全绿后 squash 合并；按 `changelogen` 发 minor 版本，release notes 必须包含 `BREAKING CHANGE`：“窗口状态不再读取旧 `window-state.json`，升级后首次启动重置窗口布局；fullscreen/kiosk 状态开始被恢复”。

## 6. 风险处理与停下条件

| 风险 | 概率 | 处理 |
| --- | --- | --- |
| Playwright 1.63 与 Chromium 156 协议不兼容，e2e 无法跑绿 | 中 | 先尝试升级 `@playwright/test`；24h 内无法解决则停，退 44.x 或维持 41 |
| electron-builder 26.8.2 打包 45 异常 | 低 | 检查 asar 清单与 `usb.node`；必要时升级 electron-builder |
| `@sentry/electron` preload 在 45 下异常 | 低 | e2e 已覆盖 preload 加载；异常则升级到 8.3.0 |
| 官方 API 为实验性，后续 minor 变更 | 中 | 精确锁定版本 + 代码注释链到官方文档；升级时重跑本计划验收 |
| 升级后首次启动窗口布局重置（既定 breaking change） | 必然 | 不写迁移代码；release notes 与配置指南明确告知，旧文件可手动删除 |
| Linux/Xvfb 无窗口管理器导致最大化断言不稳 | 高 | e2e 只断言 bounds；最大化恢复走 Windows 手工验证 |
| 42+ 惰性下载导致 CI 在 e2e 阶段才失败 | 中 | e2e job 加预热步骤；可选缓存 `~/.cache/electron` |
| 用户硬杀进程导致状态未落盘 | 低 | 官方在退出时 commit；接受极端场景丢一次状态 |

**停下条件（任一触发即停止并回报）**

- PR-A 在 24h 内无法让 4 个 required checks 全绿。
- `build:dir` 产物缺失 `usb` 原生模块或 asar 体积出现数量级劣化。
- PR-B 的官方恢复在 `--user-data-dir` 隔离环境下不可用。
- 官方 API 在 45 上出现与文档不符的行为且无法通过配置规避。

## 7. 不做的事

- 不引入 `electron-window-state` 等第三方持久化包。
- 不读取、不迁移、不自动删除旧 `window-state.json`（用户明确选择断代）。
- 不做“按显示器记忆多套布局”“窗口布局预设”等扩展。
- 不做 `clearPersistedState` 的设置页 UI。
- 不升级 React/Vite/其他无关依赖。
- 不改 Linux 标题栏策略、不改打包文件清单。

## 8. 待用户决定的问题（已给默认值，不阻塞执行）

1. `displayMode`：默认 `true`（同时恢复最大化/全屏/kiosk）。若只想要最大化，官方不支持，需要保留自定义代码——默认不这么做。
2. 目标版本：默认 45.0.0。若更保守可选 44.x（少一个破坏性版本面，但支持窗口更短）。
3. Sentry：默认不动（8.1.0）。若希望顺手升级到 8.3.0，在 PR-A 加一个独立提交。

## 9. 需要用户做的事

- 批准本计划。
- PR-A 合并前，在 Windows 真机做一次冒烟（尤其 USB 设备列表与托盘关闭）。
- 如有第二块显示器，在 PR-B 合并前做一次跨屏“移过去 → 退出 → 重启”验证。
- 发版前确认 release notes 以 `BREAKING CHANGE` 明确写出“升级后首次启动重置窗口布局”。

## 10. 变更记录

- 2026-10-23 v1：初版。依据 41/43/44/45 发布版 `electron.d.ts`、v44/v45 源码与仓库现状核查。
- 2026-10-23 v2：按用户决定取消旧 `window-state.json` 兼容，改为明确 breaking change；删除迁移相关文件、单测与验证步骤。
- 2026-10-23 v3：按用户决定移除“旧文件被忽略”的 e2e 负向用例与对应手工验证。
- 2026-10-23 v4：发现官方 bounds 持久化在 Windows 分数缩放（1.25/1.5/1.75）下每次启动漂移 1–2px；用户选择方案 B（保留官方 API），已上游提报 electron/electron#55245。

## 11. 执行记录

### 2026-10-23（本地执行）

- worktree：`H:\electron-app-temp5-electron45`；最终重放到 `main`（7a977c7，v1.9.1）。
- **PR-A** 分支 `chore/electron-45`（PR #49）：
  - `electron@45.0.0` 安装成功，lockfile 仅变动 Electron 依赖树（`@electron/get` 2→5 等）。
  - typecheck / lint / unit（58） / build / build:dir / 打包态健康检查全绿；asar 2.86 MB。
  - 全量 e2e 25/26：窗口几何用例失败。用 Electron 41 基线复证为既有环境问题（Windows 无边框窗口 `getBounds()` 含隐形边框，41/45 结果一致，仅 1px 差异）。
  - CI 首轮 e2e 失败：预热命令 `electron --version` 在 Linux 无 root 的 chrome-sandbox 下启动失败；改为 `pnpm exec install-electron`（只下载不启动）后 6 项 checks 全绿。
  - 提交：`2830562` chore(deps)、`957ad46` docs(plan)、`95d2f09` fix(ci)。
- **PR-B** 分支 `refactor/window-state-persistence`（stacked 在 PR-A 上，提交 `f8999c3`）：
  - 删除 `window-state-keeper.ts`；`WindowState` 契约移入 `window-size.ts`；主窗口改用 `name: WINDOW_IDS.HOME` + `windowStatePersistence`。
  - 偏差：`persisted-state-restored` 在窗口构造期同步触发，构造完成后无法注册监听；改为创建后记录一次 `getNormalBounds()` 日志。
  - 偏差：冷启动几何用例改为独立启动（worker 夹具可能被其他 spec 复用），像素容差放宽至 10px 以容纳 Windows 隐形边框；新增“同 userData 重启恢复 bounds”用例。
  - typecheck / lint / unit（58） / 全量 e2e（27） / build:dir 全绿。
- **已知限制（方案 B，用户已确认接受）**：Windows 分数缩放（1.25/1.5/1.75）下官方 `bounds` 持久化每次启动漂移 1–2px，整数缩放（1/2）稳定；旧 keeper 同样存在该问题且幅度更大（4–5px）。已上游提报 [electron/electron#55245](https://github.com/electron/electron/issues/55245)，代码注释与配置指南均已标注。
- **待办**：PR #49 合并前需按 §9 完成 Windows 真机冒烟；PR-B 待 #49 合并后 rebase 到 main 再推送并开 PR。
