# ConfigStore 改用 electron-store 引擎（Zod 单一真源）规划

> 状态：已批准，执行中 · v1 · 2026-10-23
>
> 前置结论：2026-10-22 九轮评审（手写 JSON vs store 库）已实测 electron-store 在本仓
> `ssr.noExternal: true`（PR #46）下全内联可行；本计划为用户拍板后的执行案。

## 1. 目标和完成标准

把 `packages/main/src/modules/config.module.ts`（99 行手写 JSON 读写）的存储引擎换成
electron-store，校验与默认值唯一真源保持为 shared 的 zod schema（刻意不传 electron-store
的 ajv `schema` 配置）。**对外接口零变化**：`getAll/get/set/reset/getAppConfigStore/
createConfigModule` 签名与行为不变，8 处消费方（config.service、native-theme、
auto-terminate、window、updater-window、updater.service、counter.service、index.ts）与
IPC/renderer 全链路零改动。

完成标准：

1. 读盘走 `configSchema.safeParse`，任一字段非法 → 整体回 `DEFAULT_CONFIG`（文件级自愈）；
   JSON 语法损坏同样回默认值；下次写盘覆盖坏文件。补上审计发现的缺口：现状
   `{...DEFAULT_CONFIG, ...parsed}` 零校验，`theme: 123` 会流进 `nativeTheme`。
2. 旧 `app-config.json` 断代：不读、不迁移、不自动删；升级后首次启动配置全部回默认；
   release notes 标 `BREAKING CHANGE`。
3. `pnpm typecheck / lint / test`、`pnpm build && pnpm test:e2e` 全绿；`pnpm build:dir`
   产物 asar 无数量级劣化。
4. Windows 冒烟：设置改动重启后保留；手改坏 config.json 启动回默认且下次写盘自愈；
   旧 app-config.json 被无视。
5. ConfigStore 补上专属单测（当前为零）。

## 2. 已定决策

- **D1 依赖位置：`packages/main/package.json` 的 devDependencies**（同 electron-log，
  PR #46 惯例：内联依赖不进 asar，无需 electron-builder files 改动）。electron-store
  12.x，ESM-only。
- **D2 构建零改动**：main 的 vite 配置已有 `ssr.noExternal: true`，electron-store 全家
  （conf/ajv 等 ~11 包）自动内联进 `dist/index.cjs`；asar 零新增包。代价：main bundle
  739KB → 约 1.0~1.2MB（ajv 作为死代码随行，已接受）。
- **D3 架空 ajv**：不传 `schema`/`defaults`/`clearInvalidConfig`。类型走泛型
  `Store<AppConfig>`（`AppConfig` 本身是 `z.infer`），校验与默认值只认 shared 的
  `configSchema`/`DEFAULT_CONFIG`。
- **D4 文件级自愈**（用户拍板）：`configSchema.safeParse(原始对象)` 整体判非法 → 全默认；
  缺失字段由 zod `.default()` 自动补齐。
- **D5 删 before-quit 兜底**：electron-store 每次 set 同步原子落盘（atomically），
  `enable()` 仅保留模块契约。
- **D6 断代方式：存储文件改用 electron-store 默认 `config.json`**（不传 `name`），
  旧 `app-config.json` 自然孤儿化——留在磁盘无害、可手动删，代码零迁移逻辑。
- **D7 范围只含配置存储**：window-state.json 不动（PR #50 官方 windowStatePersistence
  待合，接管窗口状态）。

## 3. 改动清单

| 文件 | 改动 |
| --- | --- |
| `packages/main/package.json` + `pnpm-lock.yaml` | devDependencies 加 electron-store（~11 传递包进 lockfile） |
| `packages/main/src/modules/config.module.ts` | 引擎换 electron-store（约 80 行） |
| `packages/shared/src/schemas/config.ts` | `DEFAULT_CONFIG` 改为 `configSchema.parse({})` 派生 |
| `packages/main/tests/unit/config-store.test.ts` | 新增：合法读入/缺字段补默认/字段非法整体回默认/JSON 语法损坏回默认/set 落盘回读/reset/customDir 隔离 |
| `docs/configuration-guide.md` | app-config.json → config.json（§一/§三分层表/§八/§十.6 共 4 处）；注明旧文件断代可手删 |

## 4. 不做的事

- 不用 electron-store 的 ajv schema / clearInvalidConfig / watch / onDidChange
  （broadcast 维持 controller 手动触发）。
- 不动 window-state.json 与 window-state-keeper（PR #50 域）。
- 不做旧配置读取/迁移/删除代码，不做字段级自愈、不做坏文件启动即写回（下次 set 自然覆盖）。
- 不加「重置配置」新 UI、不升级其他依赖、不改 IPC 契约与 renderer。

## 5. 风险与停下条件

| 风险 | 处理 |
| --- | --- |
| electron-store 12 ESM-only 内联异常 | 九轮评审已实测 noExternal:true 全内联跑通；异常即停回报 |
| 依赖装不上（pnpm store 无此包） | registry 已可达；在线装失败即停回报 |
| bundle 体积增长超预期 | 预期 ~1.0-1.2MB；超 1.5MB 或 asar 数量级劣化即停回报 |
| vitest 下库初始化环境问题 | 测试传 `customDir` 绕开 userData 依赖；仍不行则抽纯函数测试并 mock 库边界 |

## 6. 变更记录

- 2026-10-23 v1：定稿并批准。两处用户拍板：文件级自愈、旧 app-config.json 直接断代。
- 2026-10-23 v2：执行期发现 conf@16 在**构造期**读取整个文件，JSON 语法损坏直接抛
  SyntaxError（无绕过选项）。v2 方案=坏文件改名 `.corrupt` 隔离后重试。
- 2026-10-24 v3：用户否决隔离方案，拍板**检验失败即重置**：schema 非法 → 默认值立即
  写回覆盖；语法损坏 → 默认值直接覆盖坏文件后重建 store。不再产生 `.corrupt` 副本。

## 7. 执行记录（2026-10-23 ~ 10-24）

- electron-store@12.0.0（+15 传递包）进 main devDependencies；构建零改动。
- 门禁全绿：typecheck / lint / test 66/66 / e2e 26/26 / build:dir（asar 3.2MB，
  electron-store 链零入 asar，与 2.86MB 基线的增量来自 bundle +206KB）；main bundle
  962KB。打包产物 verify-postbuild 健康检查通过。
- 打包 exe + `--user-data-dir` 三场景冒烟通过：预置旧 app-config.json 启动
  `themeSource synced -> system`（旧文件被无视且原样保留）；坏 config.json 被隔离为
  `.corrupt` 且 warn 落盘、默认值生效、不崩；合法 config.json 正确读入（`-> dark`）。
- e2e settings 用例 4 与 configuration-guide / i18n 架构文档的 app-config.json 口径
  同批改为 config.json；新增单测 8 例（含隔离、断代残留键清理、customDir 隔离）。
- **2026-10-24 v3 改造复验**：隔离逻辑删除，替换为「检验失败即重置」（schema 非法与
  语法损坏两条路都直接用默认值覆盖坏文件）；单测 9 例重写对应断言后全绿，全量门禁
  与打包 exe 冒烟按 v3 语义复跑通过（详见 PR #52 后续提交）。

