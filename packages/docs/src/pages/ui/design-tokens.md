---
title: 设计规范与令牌（Design Tokens）
description: 从 BRAND_PRIMARY 到 Tailwind 类的三层 token 链路，以及让规范不跑偏的三道门禁。
---

# 设计规范与令牌（Design Tokens）

> **TL;DR**：从 BRAND_PRIMARY 到 Tailwind 类的三层 token 链路，以及让规范不跑偏的三道门禁。

## 要解决的坑

规范不是写在文档里就会生效的。没有 token 约束时，界面会从四个方向慢慢跑偏：

| 跑偏方式 | 典型写法 | 后果 |
| --- | --- | --- |
| 硬编码颜色 | `#10b981`、`text-white` | 换品牌/切主题时半边变色 |
| 任意值 | `text-[11px]`、`p-[13px]` | 不在任何阶上，规范失去约束力 |
| 直接改组件库 | `.ant-card { ... }`、`:global` | antd 升级即碎，样式补丁越积越多 |
| 双源手抄 | 同一色值在 CSS 与 TS 各写一份 | 一处改一处漏，肉眼看不出来 |

## 本仓库的解法

颜色只有一个种子：`BRAND_PRIMARY`。它同时喂给 antd 和布局壳，但两边**不共享 CSS 变量**，而是共享同一次算法输出。

```text
BRAND_PRIMARY
  ├─ getAntdThemeConfig(mode) → ConfigProvider
  │     algorithm + cssVar.key = 'css-var-app' + colorPrimary
  │       → antd 注入 .css-var-app { --ant-* } → antd 组件 token
  │
  └─ applyColorScheme(mode) → <html data-theme class="css-var-app">
          → index.css :root { --color-*: var(--ant-*) }
              → @theme inline → Tailwind 类 → 布局壳 / 自研组件
```

三层变量各司其职：

| 层 | 变量 | 谁生成 | 谁消费 |
| --- | --- | --- | --- |
| antd token | `--ant-*` | antd cssVar（`ConfigProvider`） | antd 组件、项目语义层 |
| 项目语义 | `--color-*` | `index.css` 的 `@layer base :root` | Tailwind 别名、`base.css` |
| Tailwind 别名 | `--color-background` 等 | `@theme inline` | 工具类 → 布局壳 / 自研组件 |

代表性的三条映射：

- `--color-primary` → `--ant-color-primary`
- `--color-bg-sunken` → `--ant-color-fill-alter`
- `--color-danger` → `--ant-color-error`（项目叫 danger，antd 叫 error）

→ 源码：[design-tokens.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/styles/design-tokens.ts) · [index.css](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/styles/index.css)

这一步把「改品牌」从两处手抄压成一个种子：改 `BRAND_PRIMARY`，antd 组件与布局壳同时变色。完整机制见[样式与令牌（Tailwind-CSS）](/ui/tailwind)与[组件库（Antd）](/ui/antd)。

## 怎么遵守

写 UI 时只消费最后一层，不碰中间层：

| 不要 | 要 |
| --- | --- |
| `#10b981`、`text-[11px]` | `bg-success`、`text-xs` |
| 组件里写 `var(--ant-*)` | `bg-background`、`text-foreground`、`border-border` |
| 直接 antd `Card` + `glass-card` | `AppCard` |
| 直接 antd `Tag` 承载状态 | `StatusTag`（中性字 + 语义色圆点） |
| `.ant-*` / `:global` 覆盖 | `antd-theme.ts` / `ConfigProvider` |

改动的正确入口：

| 想改什么 | 改哪里 |
| --- | --- |
| 品牌主色 | `styles/design-tokens.ts` 的 `BRAND_PRIMARY` |
| 新增一个语义色 | `index.css` 的 `@layer base :root` + 必要的 `@theme` 别名 |
| 非 antd 颜色（滚动条 / 语法高亮 / 窗口画布） | `tokens.css` |
| antd 组件外观 | `antd-theme.ts` / `ConfigProvider` |
| 新组件 | 语义类；卡片用 `AppCard`，状态用 `StatusTag` |

完整的五条纪律与 12 个系统见 [DESIGN.md](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/docs/DESIGN.md)。

## 防跑偏的三道门禁

| 门禁 | 命令 | 拦什么 |
| --- | --- | --- |
| 单测 | `pnpm test` | `--ant-*` 目标缺失、`--window-*` 与 antd `colorBgLayout/colorText` 不一致 |
| 预构建 | `pnpm verify:prebuild` | `text-[Npx]`、种子外 hex、组件里直接 `var(--ant-*)` |
| 端到端 | `pnpm test:e2e` | `<html>` 缺 `css-var-app`、`--color-primary` 为空、portal 丢色 |

单测用 SSR 提取 antd 的 cssVar 块，逐个断言项目引用的 `--ant-*` 都存在；e2e 在 `settings.spec` 里断言变量、antd 按钮背景与自定义 portal 的继承。

## 静默失败案例

- **类不在 `<html>`**：把 `css-var-app` 挂到 app wrapper 时，`createPortal(..., document.body)` 的自定义浮层在作用域外，背景变透明、深色下黑字，无报错。→ `applyColorScheme()` 统一挂到 `<html>`。
- **变量链路断**：`var(--color-*)` 解析不到时，`background-color` 直接失效为透明，没有 warning。→ 单测校验每个引用目标都存在。
- **antd token 改名**：CSS 里的 `--ant-*` 是字符串，改名没有编译错误。→ 单测逐个断言目标存在，升级 antd 时先报警。

## 派生应用换品牌

只改 `BRAND_PRIMARY`，不要动 `tokens.css` 或手写 `--ant-*`。antd 会自动派生 hover、浅色底与深色主题；如果连 `colorBgLayout` / `colorText` 也改了，记得同步 `tokens.css` 的 `--window-bg` / `--window-fg`（它们只负责 React 渲染前的窗口画布）。

## 注意点

- `cssVar.key` 是**类名本身**，不是前缀：本项目用 `css-var-app`，不要改成 `app`（会得到 `.app`）。
- `--window-*` 只用于 `html, body` 的首帧画布，不要拿它当业务颜色。
- 组件里禁止直接写 `var(--ant-*)`；`pnpm verify:prebuild` 会拦。

## 指针

- 配置项归属（改什么值去哪）：[配置项归属（Configuration-map）](/dx/configuration-map)
- 组件库主题装配：[组件库（Antd）](/ui/antd)
- Tailwind 层序与 `@theme`：[样式与令牌（Tailwind-CSS）](/ui/tailwind)
