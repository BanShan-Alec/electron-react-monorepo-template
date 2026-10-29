# @app/renderer AGENTS.md — 渲染进程规则（AI 必读）

> 人类向概览见 [README.md](./README.md)；全局红线与全仓任务路由见 [根 AGENTS.md](../../AGENTS.md)（其中三条全局红线在本包同样适用）。
> 本文件是该包规则的唯一真源：README 不再承载目录树 / Feature 规范 / 请求层 / 组件约定。
> 视觉与 token 纪律另见 [docs/DESIGN.md](./docs/DESIGN.md)。

## 1. 目录结构

```
src/
├── entries/                # 窗口独立入口目录（MPA 架构）
│   ├── home/               #   主窗口入口（index.html + index.tsx 挂载 + App.tsx 界面编排）
│   └── updater/            #   更新窗口入口（index.html + index.tsx 挂载 UpdaterFeature）
├── components/             # 跨 feature 复用的通用 UI（一组件一文件夹）
│   ├── ui/                 #   无业务语义的展示原子（CardTitle、CodeHighlight）
│   ├── layout/             #   全局骨架与全局兜底（Header、ErrorBoundary，含 useLingui 响应式多语言订阅）
│   └── startup/            #   StartupReadyNotifier：React 首帧就绪信号派发
├── features/               # 业务域：一个域 = 一个自包含目录（共 11 个）
│   ├── dashboard/          #   总览看板域（组合编排各 feature 的功能卡片）
│   └── …（architecture / calculator / counter / devtools / logging /
│         native-dialogs / ping / settings / system-info / updater）
├── hooks/                  # 跨 feature 的基础 hooks
│   ├── useManualRequest.ts # ahooks useRequest 的 manual-only 封装
│   ├── useIpc.ts           # 请求层：channel + api 函数 + 状态解构
│   └── useTheme.ts         # 应用级主题联动（明暗 + OS 偏好 + Tailwind dark class 同步）
├── lib/                    # 跨域能力原语
│   ├── ipc.ts              # IPC 调用与 Result 解构、IpcError、日志
│   ├── classNames.ts       # 状态类名工具（statusBoxClass）
│   └── sentry.ts           # 渲染进程 Sentry 初始化
├── locales/                # 国际化模块（LinguiJS Source-as-Key 驱动）
│   ├── i18n.ts             # dynamicActivate 动态按需加载语言包 Chunk
│   ├── zh-CN/messages.po   # 简体中文单一事实源与上下文标记
│   └── en-US/messages.po   # 英文对照翻译字典
├── startup/                # 首屏启动壳协调器（三源门禁，构建期内联进 index.html）
├── stores/                 # 全局 zustand store（themeMode / resolvedTheme / language）
└── styles/                 # design-tokens.ts + tokens.css + antd-theme.ts + base.css + index.css
../plugins/
└── startup-shell.ts        # 构建期插件（包根目录）：启动壳占位符内联
```

## 2. 分层依据

**第一层：按所有权切**——只服务一个业务域的代码进 `features/<domain>/`；被两个以上域共用的才上提到 `components/`、`hooks/`、`lib/`、`stores/`。
`components/` 属于"跨域 UI"，`hooks/`、`lib/` 属于"跨域能力"，`stores/` 属于"跨域状态"。

**第二层：按有无副作用切**——`features/<domain>/hooks/` 持有状态与 IPC 副作用，返回 view model（`{ state, handlers }`）；
`features/<domain>/components/` 纯展示，只靠 props 进入、callback 出去，不碰 IPC、不持有跨卡片状态。

**依赖方向单向**：`entries → features → 跨域层`；feature 之间禁止互相 import（可独立删除/新增），唯一合法例外是 `dashboard` 组合编排域——跨域组合一律收敛至此，不在其他 feature 内互相引用。

## 3. Feature 规范

### 1. 入口驱动（唯一公开面）

每个 feature 的 `index.tsx` 是**唯一**允许被外部 import 的文件，只导出入口组件；`hooks/`、`components/` 是私有实现，
外部不得出现 `@/features/<domain>/hooks/...` 或 `@/features/<domain>/components/...` 形式的深层引用。

```
features/calculator/
├── index.tsx                    # 公开面：<CalculatorFeature>
├── components/CalculatorCard/   # 私有：纯展示（一组件一文件夹）
│   └── index.tsx
└── hooks/useCalculator.ts       # 私有：IPC + 状态（hook 非组件，保持扁平文件）
```

### 2. 入口是容器组件，只做胶水

入口只允许"调 hook + 给卡片传 props"。一旦入口里出现条件分支、跨 feature 组合、数据编排，说明域边界划错了，
应当调整拆分而不是往入口里堆逻辑。

### 3. hook 实例化必须落在 feature 内

入口自行调用本域的 hook 并渲染卡片。**没有共享 state 需求就不上提**——App.tsx 实例化全部 hook 会让壳层与每个域的
API 耦合，随 feature 数量线性劣化。真正出现第二个消费者时再下沉到 `stores/` 或提升到 `hooks/`。

### 4. 一个域可以有多张卡片

入口可以返回 Fragment 渲染多张卡片（如 `system-info` 的 PingCard + SystemInfoCard、`diagnostics` 的 LoggingCard +
DevToolsCard）。拆分或合并域的标准是**两张卡片是否共享同一份状态与生命周期**，而不是数量。

### 5. 共享提取规则（第二个消费者）

不要预抽取。只有当第二个消费者真实出现时才把 UI 提到 `components/ui|layout/`、把纯函数提到 `lib/`、
把 hook 提到 `hooks/`。当前 `CardTitle`、`lib/statusBoxClass` 都符合该规则。

### 6. 子域组织（`sections/`）

**默认不要嵌套**。`features/` 是平坦的，`features/<domain>/` 下不再建第二层 `features/`。
判断是否需要子域，先问三个问题：**共享同一份 state 吗？共享同一组 IPC 域（同一个 controller）吗？UI 上有联动吗？**
三条全无 → 它是平级兄弟域，不是子域，直接拆成两个 feature。`logging`/`devtools`、`ping`/`system-info`
即属此类：两侧零共享 state，已按本规范由原先的 `diagnostics`、`system-info` 两域拆分为四个平级域。

三种正确形态：

| 情况 | 做法 |
| --- | --- |
| A. 共享 state / IPC / 生命周期 | 保持**单入口横向加文件**，不纵向加层：`hooks/` 按子域分文件，`components/` 各一张卡 |
| B. 零共享但同属一个大概念 | **平级拆成两个 feature**，父域不复存在 |
| C. 父域需统一控制子域的显隐 / 权限 / 编排 | 才允许二级目录 `sections/`，每个 section 自包含 |

```
features/<domain>/
├── index.tsx            # 域入口：tab / 折叠 / 权限，唯一公开面
├── sections/            # 二级域：只在 <domain> 内有意义
│   ├── <section-a>/{index.tsx, hooks/, components/}
│   └── <section-b>/{index.tsx, hooks/, components/}
├── components/          # 父域内跨 section 复用的 UI
└── hooks/               # 父域内跨 section 复用的能力
```

`sections/` 铁律：

1. 外部只允许 `import { XFeature } from "@/features/x"`；出现 `@/features/x/sections/...` 即为越界引用。
2. section 之间禁止互相 import（与顶层 feature 之间的规则相同）。
3. 深度上限两层（`domain/section`），再深就是边界划错，应回到 A 或 B。
4. section 内部结构与顶层 feature 完全一致（`index.tsx` + `hooks/` + `components/`），复用同一套心智。
5. 用 `sections/` 而非 `features/`：读路径即可分辨层级，不与顶层 `features/` 混淆。

> 两个平级 feature 需要同一段逻辑时，按第 5 条第二个消费者规则上提，**不要**用"子 feature"或引用他人内部文件来复用。

## 4. 请求层

所有 IPC 都必须走 `lib/ipc.ts`，禁止在 feature 里手写 `window.api.*` + `if (!res.success)`：
统一拿到解构后的 `data`、统一抛 `IpcError`（带 `code`）、统一计时与日志。

```ts
// 单一 channel：类型从 api 函数签名推导，data 即 Result 的 T
const { data: appConfig, runAsync: updateConfigAsync } = useIpc(
  'config.update',
  window.api.config.update,
  { onError: (err) => message.error(`更新失败: ${err.message}`) },
);

// 多 channel 编排：状态仍归 useManualRequest，service 内部用 callIpc 拼装
const { runAsync: runCounterOp } = useManualRequest(async (action: CounterAction) => {
  if (!action) return callIpc('counter.get', window.api.counter.get, []);
  return callIpc('counter.' + action, window.api.counter[action], [{ step }]);
});
```

| 场景 | 用法 |
| --- | --- |
| 一次请求对一个 channel | `useIpc(channel, window.api.x.y)` |
| 一个动作路由到多个 channel | `useManualRequest(service)`，service 内 `callIpc(...)` |
| 失败属于业务流程而非异常（如用户取消对话框） | 业务 hook 内自行转成状态，不要抛给 useIpc |
| 非 Result 形态的 api（`getPathForFile`） | 直接调用，不走请求层 |

### manual-only 铁律（自 CONTRIBUTING §一.4 下沉，2026-10-18）

- 异步请求一律使用 `useManualRequest`（ahooks `useRequest` 的 manual-only 封装）：`manual` 已写死 `true`，请求发起只能是显式的 `run()/runAsync()`。
- **一切自动触发能力一律禁止**：`refreshDeps` 依赖变化触发、`pollingInterval` 轮询、`refreshOnWindowFocus` 聚焦刷新、`ready` 门控、防抖/节流自动触发。触发点必须写在明处——事件处理器，或显式 `useEffect(() => run(...), [deps])`。
- 三层强制：类型层（封装 `Omit` 掉全部自动触发键，传了即编译错误）、Lint 层（`noRestrictedImports` 禁止直连 `ahooks` `useRequest`，仅豁免封装文件）、评审层。
- 防抖用 `useDebounceFn`、轮询用 `useInterval`、聚焦刷新用 `useEventListener` 等 ahooks/React 组合实现。

**日志纪律**：dev 下打印 channel + 耗时 + 结果；生产仅保留一行 `console.info`（与 vite 构建剔除 `console.log` 的约定一致）。
禁止打印入参 body——config 含本地路径、dialog 含 URL。日志反映 IPC 的真实结果，过期响应由 ahooks 丢弃。

## 5. 组件书写约定

- **一组件一文件夹**：组件一律是 `Xxx/index.tsx`（文件夹与组件同名、PascalCase），不存在扁平的 `Xxx.tsx` 组件文件；
  文件夹内只有 index.tsx 的"空壳"形态合法且是标准形态。先例：`components/ui/CodeHighlight/`。
- index.tsx 是**组件本体实现**，不是 re-export 桶文件（不触发 biome `noBarrelFile` / `noReExportAll`）；
  消费方 `import { X } from '@/…/X'` 按目录解析到 `X/index.tsx`。
- 附属物住址（"服务谁住谁那"）：组件私有 hook / lib / 样式住组件文件夹内（如 CodeHighlight 的 `hooks/`、`lib/`、`highlight.css`）；
  跨组件共享的上提顶层 `hooks/`、`lib/`、`styles/`；域编排 hook 留在 `features/<domain>/hooks/`。
  hook 文件本身不是组件，保持扁平 `useXxx.ts`。
- 公开面：共享 `components/` 不限制深层引用；feature 及其卡片对外仍遵守 Feature 规范第 1 条的唯一公开面规则。
- 七段式模板：私有常量 → 可抽离函数 → 变量解构 → 组件状态 → 网络IO → 数据转换 → 逻辑函数 → Effect → 渲染；
  之后是 `IXxxProps` 类型定义；类组件（ErrorBoundary）不适用。
- 命名：hook `useXxx.ts`、卡片 `XxxCard/index.tsx`、入口 `index.tsx` 导出 `XxxFeature`、常量 SCREAMING_SNAKE。
- 展示卡片（`features/*/components/**`）：`const _X = (props) => …` + `const X = memo(_X)` + `export { X }` + `export default X`。
- 容器入口（`features/*/index.tsx`）：直接 `function XFeature()`，不套 memo——内部持有 hook，memo 无收益；
  导出用 `export { XFeature }` + `export default XFeature`（勿与 `export function` 并用，TS 会报重复导出）。
- 别名：`@/` → `packages/renderer/src/*`，`@shared/` → `packages/shared/src/*`（单一事实源在根 tsconfig.json）。
- 跨端契约只从 `@shared/types` / `@shared/schemas` 消费，不反向依赖。

## 6. 国际化 (i18n)

- **源码直书中文**：文案以 `t` 宏包裹直接写在源码里，msgid 即中文原文，不存在嵌套 JSON 键名。
- **提取与校验**：`macroTransform` 只做宏转换，不产出词条；改文案后必须 `pnpm i18n:extract` 抽词条、补 en-US 译文，再跑 `pnpm i18n:check`（缺译即失败）。漏译不会在编译期报错，只会在运行时回落成中文。
- **按需加载**：`locales/i18n.ts` 经 `dynamicActivate` 动态 import 语言包 Chunk，antd 组件库 locale 同步切换。
- **切换订阅**：卡片经 `useLingui()` 订阅语言上下文，全局语言状态收敛在 `stores/useAppStore.ts`。
- **英文文案**：优先短短语；按钮/标签 ≤3 词、卡片标题 ≤5 词；Sentence case；术语按术语表；中文源括号里的实现名词可省略。细则见 [国际化文案规范（Copy）](../docs/src/pages/ui/i18n-copy.md)。
- 机制、选型与实操 SOP 见 [国际化（i18n）](../docs/src/pages/ui/i18n.md)。

## 7. 提交前门禁

根目录执行：`pnpm typecheck` · `pnpm lint` · `pnpm test`（与 CI 同款）；
包内独立校验：`pnpm --filter @app/renderer typecheck` / `lint` / `extract`。
