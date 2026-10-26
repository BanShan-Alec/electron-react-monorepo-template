---
title: React 组件编写规范（Code-partition + Hooks）
description: 组件与 hook 共用一套分区注释，状态与 IPC 副作用收在 hook，展示组件只收 props 与回调。
---

# React 组件编写规范（Code-partition + Hooks）

> **TL;DR**：组件与 hook 共用一套分区注释，状态与 IPC 副作用收在 hook，展示组件只收 props 与回调。

## 要解决的坑

Electron 项目最容易长歪的地方就是组织方式：

- 组件写法看作者心情：代码分区、命名、导出方式各有各的样

## 本仓库的解法

分区顺序固定：私有常量 → 可抽离函数 → 变量解构 → 组件状态 → 网络IO → 数据转换 → 逻辑函数 → Effect → 渲染，之后是 props 类型定义，最后 memo 加双导出。分区注释留在文件里，暂空的分区也不删——读任何组件都是同一套自上而下的叙事，人和 AI 写出来的东西趋同。hook 文件不是组件，保持扁平 `useCounter.ts`，内部同样带这套分区注释。

目录与组件壳体的约定见[组件目录结构（Component-folder）](/architecture/component-structure)；本页只看文件内部怎么写。

### 分区注释按 hook 的实际内容裁剪

hook 文件沿用同一套分区注释，只标注它真实拥有的段落。`useCounter` 在函数外放「私有常量」「可抽离的逻辑处理函数/组件」，函数体内从「网络IO」开始，接着是「组件Effect」「数据转换」「逻辑处理函数」：

→ 源码：[packages/renderer/src/features/counter/hooks/useCounter.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/features/counter/hooks/useCounter.ts)

```ts
  // 组件Effect
  // 显式挂载触发：初次拉取（run 引用稳定，不会自触循环）
  useEffect(() => {
    fetchCounter();
  }, [fetchCounter]);

  // 数据转换
  // 已有数据后的 loading 才是操作在途；首次拉取期间不显示按钮加载态
  const isUpdating = loading && counter !== undefined;

  // 逻辑处理函数
  const handleIncrement = useCallback(() => {
    void runCounterOp('increment').catch(() => {
      // 过期响应 CancelledError 与业务异常均已丢弃/提示，此处防止未处理拒绝
    });
  }, [runCounterOp]);
```

分区注释不是装饰：`isUpdating` 放在「数据转换」，说明它是从请求状态推导出的展示值；`handleIncrement` 放在「逻辑处理函数」，说明它是用户动作的入口。`useCalculator` 的分区更少，顺序是「私有常量 → 可抽离 → 网络IO → 逻辑处理函数」，没有内容的段落不出现。

### 状态与副作用归 hook，组件只收 view model

表单状态、服务端快照、加载态都住在域 hook 里：`useCalculator` 的三个操作数状态直接 `useState` 在 hook 内，组件通过 props 拿到值：

→ 源码：[packages/renderer/src/features/calculator/hooks/useCalculator.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/features/calculator/hooks/useCalculator.ts)

```ts
export function useCalculator() {
  const { message } = App.useApp();
  const [a, setA] = useState<number>(DEFAULT_OPERAND_A);
  const [b, setB] = useState<number>(DEFAULT_OPERAND_B);
  const [op, setOp] = useState<CalcOperator>(DEFAULT_OPERATOR);
```

需要跨域共享的状态才进 `stores/`。`useAppStore` 只放主题模式、解析后的明暗与语言三项全局状态：

→ 源码：[packages/renderer/src/stores/useAppStore.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/stores/useAppStore.ts)

```ts
interface AppState {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  language: SupportedLocale;
  setLanguage: (language: SupportedLocale) => void;
}

export const useAppStore = create<AppState>((set) => ({
  themeMode: DEFAULT_THEME_MODE,
  resolvedTheme: resolveTheme(DEFAULT_THEME_MODE),
  setThemeMode: (themeMode) => set({ themeMode, resolvedTheme: resolveTheme(themeMode) }),
  language: DEFAULT_LOCALE,
  setLanguage: (language) => set({ language }),
}));
```

展示卡片因此不持有业务状态：`CounterCard`、`DialogCard`、`SettingsCard` 的数据都从 props 来、变更通过回调上抛；卡片内偶尔出现的 `useState` 只服务纯 UI 的局部状态（`ChangelogCard` 的 `expanded` 展开态），不跨卡片共享。

### 回调命名：props 收 onXxx，hook 出 handleXxx

卡片对外的回调统一用 `onXxx`，props 类型集中在文件末尾的 `I<组件名>Props`：

→ 源码：[packages/renderer/src/features/counter/components/CounterCard/index.tsx](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/features/counter/components/CounterCard/index.tsx)

```ts
// props 类型定义
interface ICounterCardProps {
  count: number;
  step: number;
  onStepChange: (step: number) => void;
  isUpdating: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
}
```

hook 对外返回的交互函数通常命名为 `handleXxx`；域入口在两者之间做一次同名映射（`onIncrement={handleIncrement}`），卡片的 props 契约不暴露回调背后是本地状态还是 IPC。

### 请求只手动触发，挂载拉取写成显式 useEffect

`useManualRequest` 从类型层剔除 `refreshDeps`、`pollingInterval`、`refreshOnWindowFocus` 等自动触发键，并把 `manual` 写死为 `true`：请求只能由显式的 `run()` / `runAsync()` / `refresh()` 发起。

→ 源码：[packages/renderer/src/hooks/useManualRequest.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/hooks/useManualRequest.ts)

```ts
export function useManualRequest<TData, TParams extends unknown[] = []>(
  service: (...args: TParams) => Promise<TData>,
  options?: UseManualRequestOptions<TData, TParams>,
): UseManualRequestResult<TData, TParams> {
  // manual 写死 true：置于展开之后，运行时同样无法被 options 覆盖
  return useRequest(service, { ...options, manual: true });
}
```

挂载即拉取的域把触发点写成显式 Effect，依赖是 hook 返回的稳定 `run` 引用，不会自触循环：

→ 源码：[packages/renderer/src/features/system-info/hooks/useSystemInfo.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/features/system-info/hooks/useSystemInfo.ts)

```ts
  // 组件Effect
  // 显式挂载触发：初次拉取系统信息（run 引用稳定，不会自触循环）
  useEffect(() => {
    fetchSystemInfoRun();
  }, [fetchSystemInfoRun]);
```

用户动作的 handler 用 `void` 明确丢弃 Promise，并挂一个空的 `catch` 防止未处理拒绝——过期响应由 ahooks 的 take-latest 丢弃，业务异常已由 `onError` 提示：

→ 源码：[packages/renderer/src/features/devtools/hooks/useDevTools.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/features/devtools/hooks/useDevTools.ts)

```ts
  // 逻辑处理函数
  const handleToggleDevTools = () => {
    void runDevToolsAction({ kind: 'toggleDevTools' }).catch(() => {
      // 过期响应 CancelledError 已丢弃；业务异常已由 onError 提示，此处防止未处理拒绝
    });
  };
```

### 订阅型 Effect 必须返回清理函数

主进程推送型能力（更新状态、下载进度）在挂载 Effect 里订阅，卸载时逐个调用取消订阅函数：

→ 源码：[packages/renderer/src/features/updater/hooks/useUpdater.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/features/updater/hooks/useUpdater.ts)

```ts
    // 状态流转订阅
    const unsubState = window.api?.updater?.onStateChanged?.((newSnapshot) => {
      setSnapshot(newSnapshot);
    });

    // 下载进度流式订阅
    const unsubProgress = window.api?.updater?.onProgressChanged?.((progress) => {
      setSnapshot((prev) => ({
        ...prev,
        state: 'downloading',
        progress,
      }));
    });

    return () => {
      unsubState?.();
      unsubProgress?.();
    };
  }, [handleCheck]);
```

### 展示组件用 useLingui 订阅语言上下文

需要渲染中文文案的卡片在函数体首行裸调 `useLingui()`：不取返回值，只为订阅语言上下文，语言切换时重新渲染；文案本身用 `@lingui/core/macro` 的 `t` 宏直接写中文。

→ 源码：[packages/renderer/src/features/counter/components/CounterCard/index.tsx](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/features/counter/components/CounterCard/index.tsx)

```ts
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
```

```ts
const _CounterCard = (props: ICounterCardProps) => {
  useLingui();
  // 变量声明、解构
  const { count, step, onStepChange, isUpdating, onIncrement, onDecrement, onReset } = props;
```
