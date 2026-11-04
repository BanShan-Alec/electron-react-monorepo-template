---

title: 样式与令牌（Tailwind-CSS）
description: Tailwind v4 层序声明定覆盖规则，@theme inline 解决变量自引用与主题同源。
---

# 样式与令牌（Tailwind-CSS）

> **TL;DR**：首行显式声明 `@layer` 层级，彻底解决 Tailwind 工具类与 antd 组件样式的权重争端；利用 Tailwind v4 `@theme inline` 映射语义别名，避免 CSS 变量循环自引用。

## 1. 选型理由

在现代桌面客户端开发中，同时使用实用优先（Utility-first）工具类与企业级组件库时常面临两难：
- 覆盖关系取决于引入顺序与选择器权重，一旦构建工具调整打包顺序，样式立即出现破损。
- 暗黑模式下，两套系统各自维护一套颜色变量，极易发生色值脱节。

项目借助 Tailwind CSS v4 的原生 CSS 层机制，从底层规范两者的优先级。

## 2. 核心配置代码

### 显式层序声明与语义主题别名

→ 源码：[packages/renderer/src/styles/index.css](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/styles/index.css)

```css
/* 1. 层序声明：决定全局样式特异性覆盖规则 */
@layer theme, base, antd, components, utilities;

@import "tailwindcss" source(none);
@import "./tokens.css";
@import "./base.css";

@source "../";

/* 2. 语义别名映射：将 Tailwind 工具类接入 CSS 变量 */
@theme inline {
  --color-background: var(--color-bg-primary);
  --color-foreground: var(--color-text-primary);
  --color-border: var(--color-border);
  --color-primary: var(--color-primary);
}
```

首行层序明确规定：`utilities` 永远高于 `antd` 层。因此无论 antd 的选择器多复杂，只要在 JSX 中写 `className="mt-4 bg-background"`，Tailwind 工具类必胜。

## 3. 桌面端避坑注意事项

- **`@theme inline` 必须带 `inline` 标识符**：
  - Tailwind v4 在默认 `@theme` 中会尝试预置变量值。如果变量值是 `var(--color-bg-primary)`，无 `inline` 会导致生成的 CSS 出现变量自引用死循环（`:root { --color-background: var(--color-background); }`）。加上 `inline` 可强制只作为内联映射生成。
- **深浅主题切换不依赖 `dark:` 业务类堆砌**：
  - 暗黑模式的视觉差异由 `data-theme` 属性与底层 Antd 官方算法全自动派发，业务组件只需写语义类（如 `bg-background text-foreground`），色值会自动跟随明暗切换，禁止在每个 div 上手动堆叠大量的 `dark:bg-gray-900 dark:text-white`。
- **不给变量写硬编码 Fallback**：
  - 映射如 `--color-background: var(--color-bg-primary);` 故意不加备用默认值。一旦变量链路断开，背景将直接呈现透明，促使开发者与单元测试在第一时间暴露问题，而非隐藏潜在 Bug。
