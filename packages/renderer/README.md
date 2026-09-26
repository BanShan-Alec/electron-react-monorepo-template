# @app/renderer

渲染进程（Vite + React + antd + Tailwind + zustand + ahooks），通过 preload 暴露的 `window.api` 与主进程 IPC 通信。

```bash
pnpm --filter @app/renderer dev        # 开发
pnpm --filter @app/renderer typecheck  # 类型检查
pnpm --filter @app/renderer lint       # biome
```

## 目录总览

```
src/
├── main.tsx                # 挂载入口：createRoot + StrictMode + 全局样式
├── App.tsx                 # 应用壳层：编排面板与主题，不含任何业务逻辑
├── components/             # 跨 feature 复用的通用 UI
│   ├── ui/                 #   无业务语义的展示原子（CardTitle）
│   ├── layout/             #   全局骨架（Header）
│   └── feedback/           #   全局反馈兜底（ErrorBoundary）
├── features/               # 业务域：一个域 = 一个自包含目录
│   ├── counter/index.tsx            # 唯一公开入口 CounterFeature
│   ├── counter/hooks/useCounter.ts  # 私有：IPC + 状态
│   ├── counter/components/…         # 私有：纯展示
│   └── …（calculator / settings / native-dialogs / system-info /
│         diagnostics / architecture）
├── hooks/                  # 跨 feature 的基础 hooks
│   ├── useManualRequest.ts  # ahooks useRequest 的 manual-only 封装
│   ├── useIpc.ts            # 请求层：channel + api 函数 + 状态
│   └── useTheme.ts          # 应用级主题联动（明暗 + OS 偏好）
├── lib/ipc.ts              # IPC 调用与 Result 解构、IpcError、日志
├── stores/                 # 全局 zustand store（当前仅主题）
└── styles/                 # tokens.css（antd 设计令牌镜像）+ antd-theme.ts
```

## 分层依据

**第一层：按所有权切**——只服务一个业务域的代码进 `features/<domain>/`；被两个以上域共用的才上提到 `components/`、`hooks/`、`lib/`、`stores/`。
`components/` 属于"跨域 UI"，`hooks/`、`lib/` 属于"跨域能力"，`stores/` 属于"跨域状态"。

**第二层：按有无副作用切**——`features/<domain>/hooks/` 持有状态与 IPC 副作用，返回 view model（`{ state, handlers }`）；
`features/<domain>/components/` 纯展示，只靠 props 进入、callback 出去，不碰 IPC、不持有跨卡片状态。

**依赖方向单向**：`App.tsx → features → 跨域层`；feature 之间禁止互相 import（可独立删除/新增）。

| 目录 | 职责 |
| --- | --- |
| `src/App.tsx` | 只做编排：tab 状态、面板布局、主题 Provider；不实例化 feature hook，不透传 feature props |
| `src/hooks/useTheme.ts` | 应用级主题联动：resolvedTheme 写入 `documentElement.dataset.theme`，`system` 模式下跟随 OS 偏好 |
| `src/hooks/useIpc.ts` | 单一 IPC channel 的请求 hook：类型从 api 函数推导，内部完成 Result 解构与日志 |
| `src/hooks/useManualRequest.ts` | ahooks useRequest 的 manual-only 封装，自动触发能力从编译期到运行期均不存在 |
| `src/lib/ipc.ts` | `IpcError`（保留 `Result.code`）+ `callIpc`（解构 + 耗时 + 日志），多 channel 编排的拼装原语 |
| `src/stores/useAppStore.ts` | 唯一全局状态：`themeMode` / `resolvedTheme` |

## Feature 规范

### 1. 入口驱动（唯一公开面）

每个 feature 的 `index.tsx` 是**唯一**允许被外部 import 的文件，只导出入口组件；`hooks/`、`components/` 是私有实现，
外部不得出现 `@/features/<domain>/hooks/...` 或 `@/features/<domain>/components/...` 形式的深层引用。

```
features/calculator/
├── index.tsx                    # 公开面：<CalculatorFeature>
├── components/CalculatorCard.tsx # 私有：纯展示
└── hooks/useCalculator.ts        # 私有：IPC + 状态
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

不要预抽取。只有当第二个消费者真实出现时才把 UI 提到 `components/ui|layout|feedback/`、把纯函数提到 `lib/`、
把 hook 提到 `hooks/`。当前 `CardTitle`（7 处复用）、`lib/statusBoxClass`（3 处复用）都符合该规则。

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
## 请求层

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

**日志纪律**：dev 下打印 channel + 耗时 + 结果；生产仅保留一行 `console.info`（与 vite 构建剔除 `console.log` 的约定一致）。
禁止打印入参 body——config 含本地路径、dialog 含 URL。日志反映 IPC 的真实结果，过期响应由 ahooks 丢弃。

## 组件书写约定

- 七段式模板：私有常量 → 可抽离函数 → 变量解构 → 组件状态 → 网络IO → 数据转换 → 逻辑函数 → Effect → 渲染；
  之后是 `IXxxProps` 类型定义；类组件（ErrorBoundary）不适用。
- 命名：hook `useXxx.ts`、卡片 `XxxCard.tsx`、入口 `index.tsx` 导出 `XxxFeature`、常量 SCREAMING_SNAKE。
- 展示卡片（`components/**`）：`const _X = (props) => …` + `const X = memo(_X)` + `export { X }` + `export default X`。
- 容器入口（`features/*/index.tsx`）：直接 `function XFeature()`，不套 memo——内部持有 hook，memo 无收益；
  导出用 `export { XFeature }` + `export default XFeature`（勿与 `export function` 并用，TS 会报重复导出）。
- 别名：`@/` → `packages/renderer/src/*`，`@shared/` → `packages/shared/src/*`（单一事实源在根 tsconfig.json）。
- 跨端契约只从 `@shared/types` / `@shared/schemas` 消费，不反向依赖。

## 已知取舍

- **dashboard 常驻 + `hidden` 切换**：hook 已随 feature 收敛，若 tab 切换时卸载面板，counter 等本地状态会丢失、
  system-info/settings 会重复请求。因此两个面板都保持挂载，仅切换显隐。
- **暂不引入路由与全局业务 store**：当前 7 个域无共享 state，按第 3 条规则保持状态局部化；
  出现第二个消费者再下沉。
- **不建第二份 API map**：类型全部从 `ElectronApi`（`@shared/types/api`）推导，避免手写表与真实契约漂移。