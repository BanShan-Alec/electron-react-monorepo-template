---

title: React 组件编写规范（Code-partition + Hooks）
description: 说明 React Compiler 下的组件分区、manual-only 请求与 IPC 订阅清理约定。
---

# React 组件编写规范（Code-partition + Hooks）

> **TL;DR**：React Compiler 自动处理常见依赖记忆化；Renderer 组件按解构 → State → IO → 派生 → Handlers → Effect → JSX 的顺序组织。异步请求遵循 manual-only（单接口用 `useIpc`，多通道编排用 `useManualRequest`），事件订阅使用 Preload 暴露的 onXxx API 并清理监听。

## 1. 选型理由

桌面客户端代码生命周期极长且跨进程事件繁密。过去为了防止无序渲染，开发者不得不手动在每个计算与回调上包裹 `useMemo` / `useCallback`，不仅充斥样板代码，还容易因依赖项遗漏引发闭包死锁。

工程的现代化演进路线：
1. **编译期全自动优化**：启用官方 React Compiler，由编译器在 AST 层面自动推导状态依赖与记忆化，解放手动优化的心智负担。
2. **规范性不降级**：状态、副作用与 UI 渲染的组织范式依然至关重要，必须依靠统一的 7 段式骨架约束，确保团队成员与 AI 助手产出同构代码。
3. **斩断自动轮询黑盒**：桌面端后台常驻时，自动轮询会导致跨进程 IPC 频发与 CPU 飙升，必须强制显式请求。

### 实测证据：React Compiler 编译性能与产物验证

为验证 React Compiler 接管后的工程开销与记忆化真实有效性，项目进行了全量构建基准压测与 AST 产物反编译验证：

| 维度               | 实测数据 / 产物特征                                                                  | 工程收益                                                                                    |
| :----------------- | :----------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| **构建耗时开销**   | 开启 Compiler 编译耗时仅从 451.9ms 微增至 460.1ms（增量 **+8.2ms / +1.8%**）         | 基于 Rust 实现的 `oxc-transform-react` 底层转译，对 Vite 开发热重载与生产打包几乎零感知延迟 |
| **AST 自动记忆化** | 自动在各组件与 Hook（如 `useSystemInfo`、`ChangelogCard` 等）注入 `_c(slots)` 缓存槽 | 由编译器推导依赖拓扑并分配缓存位，彻底避免组件随父级无意义重渲染                            |
| **手动记忆化边界** | Renderer 源码仍保留显式 `useCallback`，用于有实际引用稳定性需求的回调                | 禁止样板式包裹；是否需要稳定引用应由实际依赖与 Compiler / lint 约束决定                     |

## 2. 核心机制

组件结构、Props 导出、空段处理与请求分工的规则真源见 [packages/renderer/AGENTS.md §5](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/AGENTS.md#L48)。本页提供解释与示例，不覆盖包级规则。

### 7 段式固定分区骨架

组件内部按照固定的职责切片自上而下书写；无内容的分区可以保留注释作为认知锚点，也可以按包级规范自然跳过：

→ 源码：[packages/renderer/src/features/counter/components/CounterCard/index.tsx](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/features/counter/components/CounterCard/index.tsx)

```tsx
const _CounterCard = (props: CounterCardProps) => {
  useLingui();

  // 1. 变量声明、解构
  const { count, step, onStepChange, isUpdating, onIncrement, onDecrement, onReset } = props;

  // 2. 组件状态
  // 3. 网络IO
  // 4. 数据转换（React Compiler 自动记忆化推导，无需手动 useMemo）
  const selectOptions = toSelectOptions(STEP_OPTIONS);

  // 5. 逻辑处理函数（React Compiler 自动记忆化推导，无需手动 useCallback）
  // 6. 组件Effect
  // 7. 组件渲染
  return (/* JSX */);
};

export interface CounterCardProps { /* ... */ }
export const CounterCard = memo(_CounterCard);
```

### manual-only 请求约束（useIpc / useManualRequest）

所有异步请求固定 `manual: true`。单接口请求用 `useIpc('domain.method')`；多通道编排用 `useManualRequest` 并在内部按需调用 `callIpc`，避免隐式自动触发与轮询：

→ 源码：[packages/renderer/src/hooks/useManualRequest.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/hooks/useManualRequest.ts)

```ts
export function useManualRequest<TData, TParams extends unknown[] = []>(
  service: (...args: TParams) => Promise<TData>,
  options?: UseManualRequestOptions<TData, TParams>,
): UseManualRequestResult<TData, TParams> {
  // manual 写死 true，只能通过 run()/runAsync() 显式触发
  return useRequest(service, { ...options, manual: true });
}
```

### 挂载请求与订阅清理闭环

挂载即拉取的数据通过显式 `useEffect` 触发；IPC 事件订阅使用 Preload 暴露的 `onXxx` API，并在 Effect 清理函数中调用取消订阅函数：

→ 源码：[packages/renderer/src/features/updater/hooks/useUpdater.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/features/updater/hooks/useUpdater.ts)

```ts
useEffect(() => {
  fetchUpdaterInfo();

  // 订阅主进程推送
  const unsubState = window.api?.updater?.onStateChanged?.((snapshot) => setSnapshot(snapshot));
  const unsubProgress = window.api?.updater?.onProgressChanged?.((p) => setProgress(p));

  // 必须返回清理函数，防止窗口未销毁前反复累加监听导致内存泄漏
  return () => {
    unsubState?.();
    unsubProgress?.();
  };
}, [fetchUpdaterInfo]);
```

## 3. 桌面端避坑注意事项

- **React Compiler 下的手动记忆化**：
  - 避免样板式 `useMemo` / `useCallback`；只有存在真实稳定引用需求且符合 Compiler / lint 约束时才保留或补充。Renderer 源码仍有 `useCallback` 的 Effect 与 observer 回调用例，不应追求“全仓清零”。
- **IPC 订阅回调防闭包陷阱（Stale Closure）**：
  - 在 `useEffect` 的事件监听回调中若需要读取当前的外部状态或 Props，切勿直接在闭包中读取变量，否则可能读到挂载期的旧值。推荐使用 `useRef` 保持最新引用镜像，或使用 `setState(prev => ...)` 函数式更新。
- **严禁裸写 `console.log`**：
  - 生产打包后 `console` 无法落盘，排查问题等于盲人摸象。业务与链路事件必须统一通过 `logger.info()`、`logger.error()` 记录并落盘。
- **禁止使用 `I` 前缀命名接口**：
  - Props 接口一律命名为 `<ComponentName>Props`（如 `CounterCardProps`），禁止使用过时的匈牙利命名法（如 `ICounterCardProps`）。
