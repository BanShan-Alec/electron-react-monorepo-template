# useRequest 使用约束与 useManualRequest 封装计划

> 目标仓库：`H:\electron-app-temp5`
> 生成日期：2026-09-22
> 策略决策：**二次封装 ahooks `useRequest` 为 `useManualRequest`，从类型层与 Lint 层双重禁用所有“自动触发”能力**——组件挂载触发、`refreshDeps` 依赖变化触发、轮询、窗口聚焦刷新、`ready` 门控、防抖/节流自动触发全部禁止（触发时机隐式、不可读、是隐患来源）。**跨组件缓存（`cacheKey` 家族）保留**，作为唯一合法的跨组件请求共享手段。核心诉求：请求的触发点必须在代码中显式可见（事件处理器或显式 `run()` 调用）。被封禁的能力全部提供 React 原生 / ahooks 其他 hook 组合的显式替代方案（见"禁用能力替代方案矩阵"）。

## 关联规范核验 (Referenced Specs)

- [x] 已自主查阅 [renderer/hooks-and-state.md](file:///H:/specs-electron-fullstack/renderer/hooks-and-state.md)：该规范现以“范式 A：`refreshDeps` 依赖驱动拉取”为标准写法，**与本计划的 manual-only 策略直接冲突，必须在 Phase 4 反向修订**（自动触发范式整体废止，改为“显式触发 + 封装标准”）。
- [x] 已自主查阅 [.agents/rules/01-renderer-rules.md](file:///H:/specs-electron-fullstack/.agents/rules/01-renderer-rules.md)：其“标准 IPC 消费（配合 ahooks）”示例含 `refreshDeps`，同样需同步修订。
- [x] 已自主查阅 [core/typescript.md](file:///H:/specs-electron-fullstack/core/typescript.md)：封装层遵循显式返回类型、`import type`、禁 `any`/`!`；渲染层 `verbatimModuleSyntax: true`，类型必须显式 `import type`。
- [x] 已自主查阅 [renderer/directory-structure.md](file:///H:/specs-electron-fullstack/renderer/directory-structure.md)：全局复用 Hook 归入 `src/hooks/`；该目录下**严禁桶文件**（本仓已全禁），消费方直达 `src/hooks/useManualRequest`。
- [x] 外部依据：[ahooks useRequest 文档](https://ahooks.js.org/zh-CN/hooks/use-request/basic)；能力清单以本仓 `node_modules/ahooks`（3.10.0）的 `Options` 类型定义为准逐项核对；强制手段采用 [Biome noRestrictedImports](https://biomejs.dev/linter/rules/no-restricted-imports/)（支持对指定模块禁特定命名导入）+ `overrides` 豁免封装文件。

## 现状盘点（已核实）

`useRequest` 共 **9 处调用、6 个文件**，全部在 renderer；main/preload 无使用：

| 文件 | 调用 | 现状 | 处置 |
| :--- | :--- | :--- | :--- |
| `calculator/useCalculator.ts:26` | `manual: true` + onError | ✅ 合规 | 改 import 到封装 |
| `counter/useCounter.ts:37` | **无 manual**：无参调用即挂载拉取、带 action 即用户操作（注释自述“范式 A/B 合一”） | ❌ 自动模式 | 拆为显式挂载 `run` + 手动通道 |
| `diagnostics/useDiagnostics.ts:19 / :50` | 均 `manual: true` + onSuccess/onError | ✅ 合规 | 改 import 到封装 |
| `native-dialogs/useNativeDialogs.ts:74` | `manual: true` | ✅ 合规 | 改 import 到封装 |
| `settings/useAppConfig.ts:19` | **无 manual**：挂载自动拉取 config | ❌ 自动模式 | 显式挂载 `run` |
| `settings/useAppConfig.ts:38 / :55` | `manual: true` | ✅ 合规 | 改 import 到封装 |
| `system-info/useSystemInfo.ts:30` | **无 manual**：挂载自动拉取系统信息 | ❌ 自动模式 | 显式挂载 `run` |
| `system-info/useSystemInfo.ts:50` | **无 manual**：“挂载即测” ping | ❌ 自动模式 | 显式挂载 `run` |

另核实：全库**零处**使用 `refreshDeps / pollingInterval / refreshOnWindowFocus / debounceWait / throttleWait / ready / cacheKey`——隐性选项未扩散， migration 面很小（3 个文件、4 个自动模式调用点）。

## 能力边界（对照 ahooks 3.10.0 `Options` 逐项裁决）

**禁止（封装 Options 类型中不存在这些键，传了即编译错误；直连 useRequest 由 Lint 拦截）：**

| 能力 | 选项键 | 禁止理由 |
| :--- | :--- | :--- |
| 依赖变化触发 | `refreshDeps`、`refreshDepsAction` | 触发时机散落在依赖数组，隐式 |
| 轮询 | `pollingInterval`、`pollingWhenHidden`、`pollingErrorRetryCount` | 无人可见的后台定时请求 |
| 窗口聚焦刷新 | `refreshOnWindowFocus`、`focusTimespan` | 应用级隐式触发器 |
| ready 门控 | `ready` | 条件自动触发，时机不可读 |
| 防抖/节流自动触发 | `debounceWait` 系列、`throttleWait` 系列 | 仅在自动模式下有意义，隐式合并触发 |

**保留：**
- `onBefore` / `onSuccess` / `onError` / `onFinally` / `defaultParams` / `loadingDelay` / `retryCount` / `retryInterval`：均为显式触发下的确定性行为。
- **跨组件缓存 `cacheKey` / `cacheTime` / `staleTime` / `setCache` / `getCache`：保留**。经确认这是唯一合法的跨组件请求共享手段（多组件共用同一 key 时共享 loading/data，天然去重）。因其本质仍是隐式耦合，使用处必须在注释中声明共享意图，code review 按"明知故犯"条目审查。
- `manual` 由封装内部硬编码 `true`，不对外暴露；插件参数（第三参）不暴露。

**返回面保持完整**：`loading / data / error / params / cancel / refresh / refreshAsync / run / runAsync / mutate`（`refresh*` 是带上次参数的显式再触发，保留）。

## 新 Hook 设计

位置：`packages/renderer/src/hooks/useManualRequest.ts`（新建 `hooks/` 目录的第一个文件；该目录禁桶，消费方直达此文件）。

```ts
import { useRequest } from 'ahooks';
// ahooks 根导出不含 useRequest 的 Options/Result 类型，且包无 exports 字段，
// 故从内部路径导入（版本已锁 ahooks 3.10.x；若升级后该路径失效，tsc 会显式报错，
// 届时改为本地重声明，fail-loud 不静默）
import type { Options as UseRequestOptions, Result as UseRequestResult } from 'ahooks/lib/useRequest/src/types';

/** 自动触发能力清单：从 ahooks Options 中剔除的键（manual 一并剔除，由封装硬编码） */
type AutoTriggerOptionKeys =
  | 'manual'
  | 'refreshDeps'
  | 'refreshDepsAction'
  | 'pollingInterval'
  | 'pollingWhenHidden'
  | 'pollingErrorRetryCount'
  | 'refreshOnWindowFocus'
  | 'focusTimespan'
  | 'debounceWait'
  | 'debounceLeading'
  | 'debounceTrailing'
  | 'debounceMaxWait'
  | 'throttleWait'
  | 'throttleLeading'
  | 'throttleTrailing'
  | 'ready';

/** 继承原 hook 全部选项后剔除自动触发键：ahooks 未来新增的合法选项自动获得，无需手工同步 */
export type UseManualRequestOptions<TData, TParams extends unknown[]> = Omit<
  UseRequestOptions<TData, TParams>,
  AutoTriggerOptionKeys
>;

/** 直接复用 ahooks Result，不做裁剪 */
export type UseManualRequestResult<TData, TParams extends unknown[]> = UseRequestResult<TData, TParams>;

export function useManualRequest<TData, TParams extends unknown[] = []>(
  service: (...args: TParams) => Promise<TData>,
  options?: UseManualRequestOptions<TData, TParams>,
): UseManualRequestResult<TData, TParams> {
  // manual 写死 true：置于展开之后，运行时同样无法被options覆盖；类型层已 Omit 掉 'manual'，
  // 挂载、deps、轮询、聚焦、ready 等自动触发能力从编译期到运行期均不存在
  return useRequest(service, { ...options, manual: true });
}
```

**配套使用规范（写进文档与 code review）：**
1. 触发点必须显式：事件处理器调用 `run/runAsync`，或组件显式 `useEffect(() => { run(...) }, [deps])`。挂载即拉取的语义不变，但触发点写在明处。
2. 迁移范式——原自动模式改为显式挂载触发：
   ```ts
   const { data, run } = useManualRequest(fetchSystemInfo, { onError });
   useEffect(() => {
     run();
   }, [run]); // run 引用在 ahooks 内保持稳定，不会自触循环
   ```
3. 保留 ahooks 内建 take-latest 丢弃过期响应的能力（这正是我们选择继续基于 ahooks 而非裸写的原因）。

## 禁用能力替代方案矩阵（React 原生 / ahooks 组合）

每一项被封禁的自动触发都有对应的显式组合写法；触发逻辑全部落在 `useEffect`/事件处理器的明处：

| 被封禁能力 | 替代方案 | 组合方式 |
| :--- | :--- | :--- |
| 挂载触发 | 显式 `useEffect(() => run(), ...)`，或 ahooks `useMount(() => run())` | 原生 |
| deps 变化触发（`refreshDeps`） | `useEffect(() => run(params), [params, run])`，`params` 用 `useMemo` 稳定引用；仅需“更新时触发”用 `useUpdateEffect` | 原生 + ahooks |
| ready 门控 | `useEffect` 内显式判断 `if (!ready) return; run()` | 原生 |
| 防抖输入触发（`debounceWait`） | `useDebounceFn` 直接包裹显式 `run`，输入事件里调用防抖函数，连 useEffect 都不需要 | ahooks `useDebounceFn` |
| 节流触发（`throttleWait`） | `useThrottle` / `useThrottleFn` 包裹显式 `run` | ahooks |
| 轮询（`pollingInterval`） | `useInterval` 驱动 + `loading` 守卫防请求重叠（`useInterval` 回调经 latest 引用读取最新状态，卸载自动停止） | ahooks `useInterval` |
| 窗口聚焦刷新（`refreshOnWindowFocus`） | `useEventListener('focus', () => run(), { target: window })`（自带清理） | ahooks `useEventListener` |
| 跨组件触发联动 | 显式事件总线：`useEventEmitter` 发布/订阅后调用 `run` | ahooks `useEventEmitter` |

关键范式代码：

```ts
// 1) 挂载/依赖触发：触发器写在明处，run 引用稳定不会自触循环
const { data, run } = useManualRequest(fetchSystemInfo);
useEffect(() => {
  run();
}, [run]);

// 2) 防抖搜索：useDebounceFn 包裹 run，触发点仍在事件处理器内，零 useEffect
const { run: searchProjects } = useManualRequest(searchProjectsService);
const { run: debouncedSearch } = useDebounceFn(searchProjects, { wait: 300 });
// 输入框：onChange={(e) => debouncedSearch(e.target.value)}

// 3) 轮询：useInterval 驱动，loading 守卫防请求重叠，卸载自动停止
const { runAsync, loading } = useManualRequest(pingWithLatency);
useInterval(() => {
  if (loading) return; // 上一轮未结束则跳过本轮
  runAsync().catch(() => {}); // 业务错误已由 onError 反馈；此处仅防未处理拒绝
}, 5000);

// 4) 窗口聚焦刷新：监听器与清理显式可见
const { run: refresh } = useManualRequest(fetchSystemInfo);
useEventListener('focus', () => refresh(), { target: window });
```

## 执行步骤

### Phase 0：基线确认
1. 基于已合并的 main 建分支 `refactor/manual-only-request`。
2. 记录基线：`pnpm typecheck && pnpm lint && pnpm build` 三人 Exit 0。

### Phase 1：封装落地
1. 新建 `packages/renderer/src/hooks/useManualRequest.ts`（按上节设计；首次引入 `hooks/` 目录需同步在 CONTRIBUTING 说明其“禁桶”属性）。
2. **验证**：`pnpm typecheck` Exit 0；写一个临时探针文件验证 `refreshDeps` 等禁项传入会编译失败（负向验证后删除）。

### Phase 2：迁移 6 个文件 9 处调用
1. 6 个文件 import 改为 `from '../hooks/useManualRequest'`（features 内相对路径直达，按各文件深度调整）。
2. 4 个自动模式调用点（counter:37、settings:19、system-info:30、:50）改为显式 `useEffect + run` 挂载触发；重写这三处 hook 内“范式 A/B 合一”“挂载即测”等会误导的注释。
3. counter 的“无参即拉取、带参即操作”双模式拆分为两条显式语义（拉取 run() 无参、操作 run(action)），保持对外 API 不变。
4. **验证**：`pnpm typecheck` Exit 0；diff 审查确认没有任何 `manual` 字样残留在调用侧。

### Phase 3：Lint 强制 + 豁免
`.config/biome.json` 增加（不对 useRequest 的使用做路径白名单，仅豁免封装文件自身）：

```json
"style": {
  "noRestrictedImports": {
    "level": "error",
    "options": {
      "paths": {
        "ahooks": {
          "message": "禁用直接引用 ahooks useRequest；请求一律使用 src/hooks/useManualRequest.ts",
          "importNames": ["useRequest"]
        }
      }
    }
  }
},
"overrides": [
  {
    "includes": ["packages/renderer/src/hooks/useManualRequest.ts"],
    "linter": { "rules": { "style": { "noRestrictedImports": "off" } } }
  }
]
```

注意点（已核实 Biome 文档语义）：`importNames` 只禁 `useRequest`，ahooks 的其他 hook（如未来引入 `useDebounce`）不受影响；override 按“先匹配先赢”生效，若实测发现命中 override 的文件丢失其他规则配置，则在 override 内补齐后再试。**负向验证**：临时文件 `import { useRequest } from 'ahooks'` 必须报错，`import { useDebounce } from 'ahooks'` 必须通过；删除探针后 `pnpm lint` 恢复 0 告警。

### Phase 4：specs 规范反向修订
1. [renderer/hooks-and-state.md](file:///H:/specs-electron-fullstack/renderer/hooks-and-state.md)：废止“范式 A：refreshDeps 依赖驱动拉取”整节，改为“唯一范式：显式触发（manual-only）”，写入 `useManualRequest` 封装标准与探针式示例；TL;DR 与红线条款同步。
2. [.agents/rules/01-renderer-rules.md](file:///H:/specs-electron-fullstack/.agents/rules/01-renderer-rules.md)：“标准 IPC 消费”示例改为 `useManualRequest`，补“禁止自动触发（挂载/deps/轮询/聚焦/ready/cache）”条款。
3. 说明自动触发能力的历史废止原因（隐式触发不可读、隐患），避免后来者回流。

### Phase 5：文档落地记录
1. CONTRIBUTING.md 补“请求 Hook 约束”条款并链接本计划。
2. 本文件末尾追加落地记录（提交哈希、迁移统计、验证结果）。

## 验收标准

- [ ] `useManualRequest` 选项类型中不存在任何自动触发键，类型层编译期可证。
- [ ] `pnpm typecheck && pnpm lint && pnpm build` Exit 0。
- [ ] 全库 `grep "from 'ahools'"`/`from 'ahooks'` 仅命中封装文件自身；负向探针验证规则生效后删除。
- [ ] 4 个自动模式调用点的触发点在源码中显式可见（`run()` 调用行）。
- [ ] specs 仓库两份规范反向修订完成，规则、代码、规范三处一致。
- [ ] 每 Phase 一个 commit；GUI 冒烟（pnpm start，验证系统信息/计数器/设置/Ping 挂载拉取仍工作）需人工补做。

## 工作量与风险

改动集中在 1 个新文件 + 6 个迁移文件 + 2 个配置文件 + specs 2 份。风险极低：无第三方依赖新增（ahooks 已在），无运行时行为变化（挂载拉取语义保留、take-latest 保留），主要成本是 counter 双模式拆分时的注释与测试点梳理。最大残余风险是 override 语义实测与文档表述的差异（预案见 Phase 3）。

---

## 落地记录（2026-09-22 执行完毕）

**执行基线说明**：执行时仓库 HEAD 位于 `chore/pnpm-isolated-layout`（423434b，比 main 多 13 个提交，含“Hook 层迁移 ahooks useRequest”5582c97），本任务目标代码在该分支上，故 `refactor/manual-only-request` 分支基于该 HEAD 创建；工作区内并行的依赖清理 WIP（`packages/renderer/package.json`、3 个组件、`pnpm-lock.yaml`、`packages/renderer/src/lib/`）全程未触碰、未暂存。

**提交记录**（分支 `refactor/manual-only-request`）：

| 提交 | 内容 |
| :--- | :--- |
| `60edaa7` | 新增 `packages/renderer/src/hooks/useManualRequest.ts`（Omit 继承 ahooks Options，剔除 16 个自动触发键，`manual` 写死）；迁移 6 个文件 9 处调用；4 处自动模式（counter、settings、system-info×2）改显式 `useEffect + run`；“范式 A/B”注释统一改写为显式触发语义 |
| `cad616c` | `.config/biome.json` 增加 `noRestrictedImports`（禁 `ahooks` 的 `useRequest` 命名导入）+ `overrides` 豁免封装文件 |

**验证结果**：
- 类型层负向探针：`refreshDeps` / `pollingInterval` / `manual` 三种传入均被 TS2353 拦截，封装自身编译通过。
- Lint 层负向探针：`import { useRequest } from 'ahooks'` 被 `noRestrictedImports` 拦截（含自定义中文报错），同语句的 `useDebounce` 不受影响。
- 迁移后 `pnpm typecheck` ✅、`pnpm lint` ✅（107 文件，无 error/warning）、`pnpm build` ✅ 全包通过。
- 全库 `useRequest` 引用仅剩封装文件自身。
- Phase 2 迁移中途发现并修复两处自身疏漏：6 处原本 `manual: true` 的调用残留了冗余行（被类型层如预期拦截后清除）；system-info 的 ping `useEffect` 曾因锚点误匹配被插入服务函数体内（已移至 hook 末尾）。

**Phase 4/5 完成项**：specs 仓库 [renderer/hooks-and-state.md](file:///H:/specs-electron-fullstack/renderer/hooks-and-state.md) 已反向修订（废止 `refreshDeps` 自动触发范式，改为 manual-only 唯一范式 + 封装标准 + 替代矩阵），`.agents/rules/01-renderer-rules.md`、`AGENTS.md`、`renderer/index.md`、`guides/engineering-checklist.md` 同步对齐；本仓 CONTRIBUTING.md 已补“请求 Hook 约束”条款。

**遗留事项**：Electron GUI 冒烟（`pnpm start` 验证系统信息/计数器/设置/Ping 的挂载显式拉取仍工作）需人工补做；specs 仓库变更未提交（与前序轮次一致）；本分支基于 `chore/pnpm-isolated-layout` 而非 main，合并时机需仓库维护人统筹。
