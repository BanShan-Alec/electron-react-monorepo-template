# 样式与令牌（Tailwind v4）

→ 源码：[packages/renderer/src/styles/index.css](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/styles/index.css)

```css
@layer theme, base, antd, components, utilities;

@import "tailwindcss" source(none);
@import "./tokens.css";
@import "./base.css";

@source "../";

/* ...@custom-variant 等从略 */

@theme inline {
  --color-background: var(--color-bg-primary, #0f172a);
  --color-foreground: var(--color-text-primary, #f8fafc);
  --color-border: var(--color-border, rgba(255, 255, 255, 0.1));
  /* ...其余语义色同理 */
}
```

首行的层序声明是 antd v6 + Tailwind v4 共存的基石：此后覆盖关系只看层、不看特异性与注入顺序，`utilities` 层的工具类天然压过 `antd` 层的组件样式。`@theme inline` 把 `bg-background`、`text-foreground` 这类语义类名映射到 `var()` 引用——`inline` 必须带，否则 `:root` 会出现变量自引用（Tailwind 官方文档明示的坑）。

变量的实体在 tokens.css，是 antd 官方令牌的镜像：

→ 源码：[packages/renderer/src/styles/tokens.css](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/styles/tokens.css)

```css
:root {
  color-scheme: light;
  --color-bg-primary: #f5f5f5;
  --color-text-primary: rgba(0, 0, 0, 0.88);
  /* ... */
}

:root[data-theme="dark"] {
  --color-bg-container: #141414;
  /* ... */
}
```

明暗切换靠一个 `data-theme` 属性驱动：

→ 源码：[packages/renderer/src/hooks/useTheme.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/hooks/useTheme.ts)

```ts
useEffect(() => {
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
}, [resolvedTheme]);
```

`dataset.theme` 激活 tokens.css 的变量组，`.dark` 类维持 Tailwind 的 dark 变体机制。布局壳（Tailwind 类）与 antd 组件读同一组变量，视觉完全同源。

注意点：

- 深浅主题的视觉差异由 `data-theme` 属性 + antd 官方算法驱动，不要用 `dark:` 前缀类堆业务分支
