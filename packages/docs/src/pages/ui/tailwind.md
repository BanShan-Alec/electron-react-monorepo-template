---
title: 样式与令牌（Tailwind-CSS）
description: "层序声明 + antd cssVar 变量 + `@theme inline`，工具类与 antd 组件读同一次算法输出。"
---

# 样式与令牌（Tailwind-CSS）

> **TL;DR**：层序声明 + antd cssVar 变量 + `@theme inline`，工具类与 antd 组件读同一次算法输出。

## 要解决的坑

antd 组件样式与 Tailwind 工具类共存时互相打架：覆盖关系取决于注入顺序与特异性，谁后加载谁赢，样式回归防不胜防。深浅主题则是第二重难题——两套组件体系各自维护色值，必然漂移。

## 本仓库的解法

### 层序声明定覆盖规则

→ 源码：[packages/renderer/src/styles/index.css](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/styles/index.css)

```css
@layer theme, base, antd, components, utilities;

@import "tailwindcss" source(none);
@import "./tokens.css";
@import "./base.css";

@source "../";

/* ...@custom-variant 等从略 */

@theme inline {
  --color-background: var(--color-bg-primary);
  --color-foreground: var(--color-text-primary);
  --color-border: var(--color-border);
  /* ...其余语义色同理；不写 fallback，缺变量应当显形 */
}
```

首行的层序声明是 antd v6 + Tailwind v4 共存的基石：此后覆盖关系只看层、不看特异性与注入顺序，`utilities` 层的工具类天然压过 `antd` 层的组件样式。`@theme inline` 把 `bg-background`、`text-foreground` 这类语义类名映射到 `var()` 引用——`inline` 必须带，否则 `:root` 会出现变量自引用（Tailwind 官方文档明示的坑）。

### 变量实体：antd cssVar + 项目语义别名

`ConfigProvider` 开启 `cssVar: { key: 'css-var-app' }`，antd 在 `.css-var-app` 作用域注入
`--ant-color-*` 全套变量；`applyColorScheme` 把该类挂到 `<html>`，保证 `:root` 与 portal 都能解析。
`index.css` 的 `:root` 再把项目语义名映射到 antd 变量，`@theme inline` 最后把它们变成 Tailwind 类。

→ 源码：[design-tokens.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/styles/design-tokens.ts) · [index.css](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/styles/index.css)

```ts
export const CSS_VAR_KEY = 'css-var-app';

// createRoot 之前：切 data-theme/.dark 并挂作用域类
applyColorScheme(useAppStore.getState().resolvedTheme);
```

```css
@layer base {
  :root {
    --color-primary: var(--ant-color-primary);
    /* …共 15 项 */
  }
}
```

`tokens.css` 只保留不来自 antd 的令牌：`color-scheme`、滚动条、语法高亮，
以及 React 渲染前的 `--window-bg` / `--window-fg` 窗口画布。

## 深浅主题切换

明暗切换靠一个 `data-theme` 属性驱动：

→ 源码：[packages/renderer/src/hooks/useTheme.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/hooks/useTheme.ts)

```ts
useEffect(() => {
  applyColorScheme(resolvedTheme); // 同步 data-theme、.dark 与 cssVar 作用域类
}, [resolvedTheme]);
```

`applyColorScheme` 激活 cssVar 作用域类与 `.dark` class；antd 变量由 `ConfigProvider` 随算法切换。布局壳读 `:root` 语义别名（最终指向 `--ant-*`），antd 组件读同一次算法输出，两边同源。

## 注意点

- 深浅主题的视觉差异由 `data-theme` 属性 + antd 官方算法驱动，不要用 `dark:` 前缀类堆业务分支
