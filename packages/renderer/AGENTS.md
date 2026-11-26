# @app/renderer AGENTS.md — 渲染进程架构与规则

> 全局红线与全仓任务路由见 [根 AGENTS.md](../../AGENTS.md)。本文件为该包规则唯一真源。
> 视觉与 token 纪律另见 [docs/DESIGN.md](./docs/DESIGN.md)；事件推送侧契约见本文 §4。

## 1. 架构分层与所有权

- **单向流动**：`entries ➔ features ➔ 跨域层 (components/hooks/lib/stores)`。Feature 间严格互相独立、禁止互相 import；跨域组合仅限 `dashboard` 编排域。
- **所有权原则**：业务代码就近收敛在 `features/<domain>/`，仅当真实出现第 2 个独立消费者时才上提到全局跨域层。
- **副作用隔离**：`features/<domain>/hooks/` 统一持有状态与 IPC（输出 ViewModel）；`features/<domain>/components/` 保持纯展示，不碰 IPC、不持有跨卡片状态。

## 2. Feature 规范

1. **入口驱动**：每个 feature 的 `index.tsx` 是唯一允许被外部 import 的文件，仅负责调用本域 hook 并向卡片传递 props，严禁深层路径引用（如 `@/features/x/hooks/...`）。
2. **状态下沉**：hook 必须在 feature 内部实例化，严禁在顶层 App 集中实例化导致壳层耦合。
3. **子域组织**：默认保持扁平；复杂父域允许二级 `sections/`（自包含且深度上限 2 层，section 间禁止互相 import）。

## 3. 请求层与 manual-only 铁律

所有 IPC 通信必须走安全包装层，严禁在业务中手写 `window.api.*` + `if (!res.success)` 散装解构。

- **调用原语**：单接口请求一律使用 `useIpc('domain.method')`；多通道业务编排使用 `useManualRequest` 并在内部按需调用 `callIpc('domain.method', args?)`。
- **manual-only 铁律**：所有异步请求写死 `manual: true`，严禁隐式轮询/自动触发，触发点必须显式（事件回调或挂载 `useEffect`）；防抖用 `useDebounceFn`，轮询用 `useInterval`。
- **安全纪律**：仅记录 channel、耗时与结果状态；严禁在日志中打印包含敏感路径与 URL 的入参 body。

## 4. 事件通道契约（主进程 ➔ 渲染层推送侧）

所有主进程 ➔ 渲染层推送通道，在 `@app/shared` 声明时必须**显式归类**为以下二选一，并在 `ElectronApi` 类型上可区分：

| 类别                     | 语义                                                     | preload 实现                                                                             | 渲染层消费契约                           |
| :----------------------- | :------------------------------------------------------- | :--------------------------------------------------------------------------------------- | :--------------------------------------- |
| **粘性状态** (Sticky)    | 最新一条事件即当前状态（快照型：更新器状态机、配置变更） | `createStickyChannel` 包装：常驻监听 + 缓存重放 + 引用守卫（见 `preload/src/sticky.ts`） | 挂载即得最新值，无时序竞争；返回取消函数 |
| **瞬态通知** (Transient) | 错过即错过（Toast 型、一次性提示、进度脉冲）             | 裸 `ipcRenderer.on` 包装，但**必须返回取消函数**                                         | `useEffect` cleanup 中成对调用           |

**判据**：渲染层挂载迟到时，丢一条消息会不会导致 UI 显示错误状态？会 ➔ 粘性；只是少一次闪烁/提示 ➔ 瞬态。

铁律：

1. **瞬态事件不是状态源**。任何由事件驱动的 UI 状态，必须存在对应的 `invoke` 重取路径；事件只做「提示该刷新了」。渲染层持有的是缓存，不是第二真相源——缓存过期以重取为准，不以上次收到的事件为准。
2. **订阅必须成对释放**。消费侧 hook 的 effect cleanup 必须调用订阅返回的取消函数；禁止组件卸载后仍持有监听（泄漏的监听会在事件到达时对已卸载组件 setState）。
3. **高频流必须收敛**。速率可能达到每秒十次级的通道（进度、日志、字节级推送），消费侧必须节流 / 合并 / 窄选后再进状态，禁止逐事件 `setState` 引发整卡重渲染。工具：`useDebounceFn` / `useInterval`（同上一节），或自建 rAF 批量提交。
4. **禁止绕过包装层**。业务代码不得直接手写通道名订阅；新增通道先补 preload 包装与 `ElectronApi` 类型声明，再消费。

## 5. UI 组件选型与组件库优先 (Component-First)

实现任何 UI 功能、布局、状态指示与交互反馈时，**必须优先选用已安装的 Ant Design (antd) 组件库，严禁手写原生 HTML 标签或滥用 Tailwind 原子类拼装模拟已有组件（严禁重复造轮子）**。

包装组件（`AppCard` / `StatusTag` / `EllipsisText` 等）的具体用法细则另见 [docs/DESIGN.md](./docs/DESIGN.md) §5 recipes。

### 1. 规范矩阵与查对表

| 业务场景 / UI 需求      | 优先标准组件 / 规范                                                    | 严禁的重复造轮子 Anti-Pattern                         |
| :---------------------- | :--------------------------------------------------------------------- | :---------------------------------------------------- |
| **状态小圆点 / 徽标**   | `<Badge color="var(--color-*)" />` 或 `status="success\|warning\|..."` | 裸手写 `<span className="size-2 rounded-full ..." />` |
| **状态标签 / 业务标记** | `<StatusTag tone="..." />` 或 `<Tag />`                                | 裸手写 `div/span` 拼装背景色与文字                    |
| **交互提示 / 悬浮说明** | `<Tooltip title="...">` 或 `<Popover>`                                 | 裸手写 CSS `hover:block` / 自定义悬浮层               |
| **操作按钮与加载反馈**  | `<Button loading={...}>`（配合 `loadingDelay`）                        | 裸手写 `<button>` 并手动插入 Spinner SVG              |
| **数据展示与空态骨架**  | `<Empty />` · `<Skeleton />` · `<Statistic />` · `<Descriptions />`    | 裸手写无数据提示、加载骨架占位                        |
| **卡片与容器布局**      | `<AppCard />`（统一规范）· `<Space />` · `<Flex />`                    | 随意手写裸 `div.card` 并随意覆盖边框与阴影            |

### 2. context7 MCP 文档即时查阅机制 (Docs-First)

在编写、封装或重构涉及第三方库（尤其是 Ant Design 组件、图标与 React 特性）的代码时，**严禁凭历史记忆盲猜 API、属性名或破坏性变更**：
1. **即时查阅最新契约**：必须调用 `context7` MCP 工具（先经 `resolve-library-id` 解析库标识如 `antd`，再通过 `query-docs` 查询精确组件 API 与用法示例）。
2. **版本与规范对齐**：本项目使用 Ant Design 现代版本，组件属性必须符合当前官方最新规范，禁止引入已过时或已被弃用的废弃属性。
3. **定制边界**：当组件库原生确有无法覆盖的特异化场景时（如 4 阶段多色堆叠进度条），允许使用语义化容器（如 Flex + ARIA）扩展，但前缀/后缀、小圆点及 Tooltip 交互仍必须最大化复用 AntD 基础原语。

### 3. 无边框窗口的拖拽区与浮层命中（Electron）

无边框窗口（`frame: false`）靠 `.drag-region`（`-webkit-app-region: drag`）让区域可拖动。**Electron 判定拖拽区是按几何矩形，而不是按 DOM 绘制层级**：任何 portal 浮层叠在拖拽区上方时，鼠标事件会被当成「拖窗口」吞掉，表现为 **hover 无高亮、点击无反应**，而键盘依然可用（不经过命中测试）—— 这个不对称是判断此问题的关键证据。

规则：

1. 拖拽区内的可交互元素（链接、按钮、开关）必须加 `.no-drag`；
2. **浮层要把 `no-drag` 挂在浮层根节点上**，而不是只加在触发按钮上：`<Dropdown rootClassName="no-drag">`、`<Popover rootClassName="no-drag">`、`<Tooltip overlayClassName="no-drag">`（antd 各组件挂载位置不同，以实际 popup 根节点为准；改完用 `getComputedStyle(popup).webkitAppRegion === 'no-drag'` 自检）；
3. 模态层（`Modal` / `message`）通常居中、不落在拖拽区内，但若浮层贴顶（如顶部溢层菜单），同样适用第 2 条。

> 实例：更新窗口的信息区整块是拖拽区，右上角「更多」菜单弹出后落在该矩形内，未加 `no-drag` 时用户手点无效、自动化测试却点得动（CDP 注入事件绕过浏览器进程的命中测试）—— 单靠 e2e 无法发现，必须真窗口手验。

## 6. 组件书写约定与七段式语义模板

### 1. 结构与导出纪律

- **一组件一文件夹**：组件一律为 `Xxx/index.tsx`（PascalCase 目录，本体实现而非桶文件，不触发 Biome `noBarrelFile`）。
- **Props 接口规范**：Props 类型必须使用 `export interface XxxProps` 声明（空 props 统一采用 `export type XxxProps = Record<string, never>`），禁止行内字面量。
- **导出与 Memo 规范**：展示卡片统一使用具名导出并包裹 `memo`（`export const X = memo(_X)`，杜绝 `export default`）；入口容器组件使用 `export { XFeature }`，不套 memo。
- **React Compiler 纪律**：全仓由 React Compiler 全自动接管依赖记忆化，禁止手写样板式 `useMemo` 与 `useCallback`；遵守组件纯函数渲染，严禁在 render 期间读写 `ref.current`（Biome `useReactCompiler` 为 error 刚性阻断）。展示组件按约定包裹外层 `memo(_Xxx)` 导出以阻断跨组件重渲染。

### 2. 组件代码七段式语义模板

组件源码必须严格按以下语义块自上而下单向布局，禁止状态、异步与副作用穿插混杂：

```tsx
// 1. 私有常量（模块级静态配置，组件外声明避免 re-render 重复分配内存）
const DEFAULT_PAGE_SIZE = 20;

// 2. 可抽离的纯逻辑/子渲染函数（无外部 hook 依赖，便于单独单测）
function formatItem(item: Item) { return ...; }

// 3. 组件本体（私有命名 _Xxx）
const _UserCard = (props: UserCardProps) => {
  useLingui(); // 多语言响应订阅

  // ① 变量声明、解构（Props 属性、全局 Store / Context）
  const { title, userId, onRefresh } = props;
  const { message } = App.useApp();

  // ② 组件状态（useState, useRef, useReducer 等本地可变状态）
  const [filterText, setFilterText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // ③ 网络IO / 异步操作（useIpc, useManualRequest 等通信 Hooks）
  const { data, loading, runAsync } = useIpc('user.get');

  // ④ 数据转换 / 派生（React Compiler 自动记忆化推导，无需手动 useMemo）
  const filteredList = data?.filter((item) => item.name.includes(filterText)) ?? [];

  // ⑤ 逻辑处理函数（事件响应回调、交互处理 handler）
  const handleItemClick = (id: string) => { ... };

  // ⑥ 组件 Effect（useEffect 外部系统同步、事件监听与清理）
  useEffect(() => { ... }, [userId]);

  // ⑦ 组件渲染（返回单一或片段 JSX 结构）
  return <AppCard title={title}>...</AppCard>;
};

// 4. Props 类型定义（必须具名 export interface）
export interface UserCardProps {
  title: string;
  userId: string;
  onRefresh?: () => void;
}

// 5. 导出与 Memo（展示组件统一 memo 包装具名导出）
export const UserCard = memo(_UserCard);
```

> **语义分块纪律**：
> 1. **静态在外、动态在内**：常量与纯函数必须提取到组件函数体外部，不占用重渲染开销。
> 2. **单向线性流**：函数体内严格遵循 `解构 ➔ State ➔ IO ➔ 派生 ➔ Handlers ➔ Effect ➔ JSX`。
> 3. **无内容跳过不颠倒**：若无“网络IO”或“Effect”，可保留单行注释占位或自然跳过，但绝不可颠倒相对顺序。

## 7. 国际化 (i18n)

- **源码直书中文**：文案以 LinguiJS 的 `t` 宏包裹（`t`文案``），中文原文即 msgid（Source-as-Key），杜绝层级 JSON 键名。
- **提取与完整性校验**：改动文案后必须在根目录执行 `pnpm i18n:extract` 抽词条并补充 `en-US/messages.po` 翻译，随后运行 `pnpm i18n:check`（缺译即失败）。
- **动态按需加载**：`locales/i18n.ts` 经 `dynamicActivate` 动态加载语言包 Chunk，组件通过 `useLingui()` 响应式监听语言切换。

## 8. 提交前门禁

- 根目录执行：`pnpm typecheck` · `pnpm lint` · `pnpm test`。
- 文案改动追加执行：`pnpm i18n:check`。
