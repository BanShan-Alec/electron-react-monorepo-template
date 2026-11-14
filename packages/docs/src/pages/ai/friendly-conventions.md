---

title: AI 友好代码约定（Reference-style）
description: 提供 AI 协作提示词，并指向组件规范、Zod 契约与提交校验的单一真源。
---

# AI 友好代码约定（Reference-style）

> **TL;DR**：让 AI 产出稳定代码的关键是明确规则入口和可验证边界。本页提供初始化提示词，并链接到组件、契约与提交规范的唯一真源，避免重复维护实现细节。

## 1. 选型理由

- **代码风格收敛**：不同 AI 编程助手（Claude Code / Cursor / Windsurf / Copilot）生成的组件结构天差地别，缺乏固定锚点会导致 Git Diff 中充斥大量代码块搬家噪声。
- **机器可判定性（Machine-verifiable）**：约定必须挂在编译器、Linter 或 Git Hook 上，AI 生成完毕后直接跑 `pnpm lint` 和 `pnpm typecheck` 即可自检修复，不依赖评审人主观口味。
- **单一真源与杜绝空话**：拒绝“请遵循规范”的空洞说教，直接提供可复制的骨架模板与单一真源契约模式。

## 2. 核心代码与实现模板

### 1. 复制即用的 AI System Prompt 规范注入

```markdown
你是一个精通 Electron 45、React 19 和 TypeScript 的资深架构师。在本仓库编写代码时，必须无条件遵循以下铁律：
1. 【禁止桶文件】：严禁新建只做 re-export 的 index.ts，严禁使用 export *。
2. 【组件规范】：Renderer 组件结构、Props 与空段处理遵循 `packages/renderer/AGENTS.md` §5，不在提示词中重复维护模板。
3. 【IPC 单一真源】：跨端通信必须在 packages/shared 定义 Zod Schema 与 IPC 通道常量。
4. 【Commit 规范】：提交信息 subject 必须包含简体中文，格式：<type>(<scope>): <中文说明>。
```

### 2. React 组件 7 段式标准注释骨架

→ 规范真源：[packages/renderer/AGENTS.md](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/AGENTS.md) · [架构文档](/architecture/react-conventions)

```tsx
import { memo } from 'react';

// 私有常量与可抽离工具函数
const STEP_OPTIONS = [1, 5, 10];

interface CounterCardProps {
  step: number;
  onStepChange: (step: number) => void;
}

const _CounterCard = (props: CounterCardProps) => {
  // 1. 变量声明、解构
  const { step, onStepChange } = props;

  // 2. 组件状态
  // const [count, setCount] = useState(0);

  // 3. 网络IO (必须使用 useManualRequest 或 useIpc，严禁自动轮询)

  // 4. 数据转换（React Compiler 自动记忆化推导，无需手动 useMemo）
  const formattedStep = `步长: ${step}`;

  // 5. 逻辑处理函数（React Compiler 自动记忆化推导，无需手动 useCallback）
  const handleSelect = (nextStep: number) => {
    onStepChange(nextStep);
  };

  // 6. 组件Effect (挂载请求与清理闭环)

  // 7. 组件渲染 (JSX)
  return (
    <div className="p-4 border rounded">
      <span>{formattedStep}</span>
      <button type="button" onClick={() => handleSelect(5)}>
        设为5
      </button>
    </div>
  );
};

export const CounterCard = memo(_CounterCard);
```

### 3. Zod 强类型 IPC 契约模式

→ 源码：[packages/shared/src/schemas/close-behavior.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/schemas/close-behavior.ts)

```ts
import { z } from 'zod';

// 1. 定义入参枚举契约（单一真源）
export const closeBehaviorChoiceSchema = z.enum(['window', 'quit', 'cancel']);
export type CloseBehaviorChoice = z.infer<typeof closeBehaviorChoiceSchema>;

// 2. 在主进程 Controller 中一行校验，入参自动具备类型推导：
// const validatedChoice = closeBehaviorChoiceSchema.parse(rawInput);
```

### 4. 中文 Commitlint 正则与 Biome 门禁

→ 源码：[.config/commitlint.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.config/commitlint.config.ts)

```ts
// 强制提交说明包含中文（机器判定）
plugins: [
  {
    rules: {
      'subject-chinese': ({ subject }) => {
        const hasChinese = /[\u4e00-\u9fa5]/.test(subject || '');
        return [hasChinese, '提交说明 (subject) 必须包含简体中文描述意图'];
      },
    },
  },
],
rules: {
  'subject-chinese': [2, 'always'], // 2 即 error 级别
}
```

## 3. 桌面端避坑注意事项

| 避坑要点                       | 事故表现与原因                                                                    | 本仓库对齐方案                                                                                                                                                        |
| :----------------------------- | :-------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **组件结构漂移导致 Diff 噪声** | 组件状态、请求与副作用随意交错，反复重排会掩盖真正的业务改动。                    | 按 [Renderer 组件规范](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/AGENTS.md#L48) 的顺序组织；空段处理以该规则为准。 |
| **过度手动使用 useMemo**       | AI 在 React 19 环境下仍机械地给所有函数套 `useCallback`，代码冗长且徒增闭包开销。 | 本仓库已开启 **React Compiler** 自动记忆化，禁止 AI 编写样板式 `useMemo` / `useCallback`。                                                                            |
| **Commit 校验不可判定**        | 仅口头要求“提交写清楚”，导致出现大量无意义的 `git commit -m "fix"`。              | Commitlint 规则强制拦截无中文提交，Husky 挂钩校验失败立即中断 commit。                                                                                                |
| **随意引入桶文件导出**         | AI 习惯新建 `index.ts` 并写 `export * from './xxx'`，导致模块加载变慢。           | Biome 规则开启 `"noBarrelFile": "error"` 与 `"noReExportAll": "error"`，硬性阻断。                                                                                    |
