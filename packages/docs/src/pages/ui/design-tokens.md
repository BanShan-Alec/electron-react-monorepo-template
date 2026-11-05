---

title: 设计规范与令牌（Design Tokens）
description: 单一品牌色种子派生全套色阶，三层 Token 管道映射与门禁拦截机制。
---

# 设计规范与令牌（Design Tokens）

> **TL;DR**：全仓色彩源于唯一种子 `BRAND_PRIMARY`；经 Ant Design 官方算法派生 `--ant-*` 变量，映射为项目语义变量后由 Tailwind `@theme inline` 消费；`applyColorScheme` 挂载在 `<html>` 确保 Portal 浮层正常继承。

## 1. 选型理由

桌面端界面最容易在维护中演变为“视觉灾难”：
1. **硬编码色值泛滥**：业务组件充斥 `#10b981`、`text-white`，切暗黑模式时半边页面失控。
2. **Portal 浮层掉色**：下拉菜单或模态弹窗挂载在 `document.body` 根节点，脱离局部作用域导致样式丢失。
3. **组件库补丁破碎**：在全局写大量的 `.ant-card { ... }` 覆盖样式，一旦组件库小版本升级全盘崩溃。

工程建立了严格的单向 Token 派生管道：
```text
BRAND_PRIMARY (唯一品牌种子)
    │
    ▼
Ant Design 算法 (getAntdThemeConfig) ──> 注入 .css-var-app { --ant-* }
    │
    ▼
项目语义层 (index.css :root)          ──> 映射 --color-* 变量
    │
    ▼
Tailwind v4 (@theme inline)          ──> 生成 bg-background, text-primary 等工具类
```

## 2. 核心机制（单一真源）

### 全局色彩与作用域切换原子函数（applyColorScheme）

上层 `useAppStore` 解析出最终的 `ThemeMode`（`'light' | 'dark'`），由原子函数挂载至 `<html>` 根节点：

→ 源码：[packages/renderer/src/styles/design-tokens.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/styles/design-tokens.ts)

```ts
export const BRAND_PRIMARY = '#1677ff';
export const CSS_VAR_KEY = 'css-var-app';

export function applyColorScheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.classList.toggle('dark', mode === 'dark');
  root.classList.add(CSS_VAR_KEY);
}
```

### 三层映射体系与 Tailwind v4 适配

→ 源码：[packages/renderer/src/styles/index.css](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/styles/index.css)

```css
@layer theme, base, antd, components, utilities;

@layer base {
  :root {
    --color-primary: var(--ant-color-primary);
    --color-bg-primary: var(--ant-color-bg-container);
    --color-text-primary: var(--ant-color-text);
    --color-border: var(--ant-color-border);
  }
}

@theme inline {
  --color-background: var(--color-bg-primary);
  --color-foreground: var(--color-text-primary);
  --color-border: var(--color-border);
}
```

## 3. 桌面端避坑注意事项

- **作用域类名必须挂在 `<html>` 根节点**：
  - 如果把 `css-var-app` 挂在 React 的 `#root` 节点，所有由 `createPortal(..., document.body)` 渲染的 Select 下拉框、Modal 对话框和 Tooltip 都会脱离变量作用域，在深色模式下变成透明背景与黑色文字。
- **`cssVar.key` 是完整的类名而非前缀**：
  - Ant Design 配置项中 `cssVar: { key: 'css-var-app' }` 生成的直接是 `.css-var-app` 类选择器，不要只传 `app`（否则会生成 `.app`）。
- **业务代码禁止直读 `--ant-*` 变量**：
  - 组件业务样式统一消费 Tailwind 语义类（如 `bg-background`、`text-foreground`）或通用组件包装器（如 `AppCard`），严禁在 CSS 中硬编码 `var(--ant-*)`。静态预检门禁（`pnpm verify:prebuild`）会扫描并拦截违规写法。
