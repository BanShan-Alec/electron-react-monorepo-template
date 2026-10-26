# 组件目录结构（一组件一文件夹）

## 要解决的坑

Electron 项目最容易长歪的地方就是组织方式：

- 组件写法看作者心情：代码分区、命名、导出方式各有各的样

## 本仓库的解法

### 3. 组件编写模板：一组件一文件夹 + 固定代码分区

→ 源码：[packages/renderer/src/features/counter/components/CounterCard/index.tsx](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/features/counter/components/CounterCard/index.tsx)

```tsx
// 私有常量
const STEP_OPTIONS = [1, 5, 10, 50];

// 可抽离的逻辑处理函数/组件
function toSelectOptions(steps: number[]) {
  return steps.map((step) => ({ label: String(step), value: step }));
}

const _CounterCard = (props: ICounterCardProps) => {
  useLingui();
  // 变量声明、解构
  const { count, step, onStepChange, isUpdating, onIncrement, onDecrement, onReset } = props;

  // 组件状态

  // 网络IO

  // 数据转换
  const selectOptions = toSelectOptions(STEP_OPTIONS);

  // 逻辑处理函数

  // 组件Effect

  // 组件渲染
  return (/* JSX */);
};

// props 类型定义
interface ICounterCardProps { /* ... */ }

const CounterCard = memo(_CounterCard);

export { CounterCard };
export default CounterCard;
```

文件内部的分区顺序见 [React 组件编写规范（代码分区与 hooks 约定）](/architecture/react-conventions)，本页只看目录。

一组件一文件夹是标准形态，不存在扁平的 `Xxx.tsx` 组件文件：

→ 源码：[packages/renderer/src/components/ui/CodeHighlight/index.tsx](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/components/ui/CodeHighlight/index.tsx)

```tsx
import { useCodeHighlight } from './hooks/useCodeHighlight';
import './highlight.css';
```

组件一律是 `Xxx/index.tsx`（目录与组件同名 PascalCase）。组件私有的 hook、lib、样式住组件文件夹内——CodeHighlight 的 `hooks/`、`lib/`、`highlight.css` 都在同一个目录；被跨组件共享的才上提顶层 `hooks/`、`lib/`、`styles/`。注意组件本体的 `index.tsx` 是实现文件，不是 re-export 桶文件。

设计动机：目录即组件边界。改一个组件只打开一个文件夹，Code Review 的 diff 也天然按组件聚合。

注意点：

- 一组件一文件夹是标准形态，不存在扁平 `Xxx.tsx` 组件文件；组件本体的 `index.tsx` 不是桶文件
