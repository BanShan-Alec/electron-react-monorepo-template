# DESIGN.md — renderer 视觉规范（纪律与指针）

AI 在 renderer 写样式时唯一需要遵守的视觉纪律；品牌定制入口见文末。本文**不复制色板**——颜色真源在代码里（见指针）。

## 纪律

1. **禁硬编码颜色 / 间距 / 字体值**：一律使用 `var(--color-*)` CSS 变量或 Tailwind 主题类（`bg-primary`、`text-foreground` 等）。
2. **层级秩序**（antd v6 + Tailwind v4 官方配比）：`index.css` 首行声明 `@layer theme, base, antd, components, utilities`，`AppProviders` 用 `<StyleProvider layer>` 把 antd 样式收进 `@layer antd`。覆盖关系只看层：Tailwind utilities 可直接覆盖 antd 组件（写 `className` 即可，无需 `!important`）；自己的组件类进 `components` 层；**不要在层外写裸样式**。唯一豁免：`tokens.css` 的 `:root` 非颜色令牌（滚动条 / 语法高亮）保持未分层；颜色变量由行内样式注入，不参与层序竞争。
3. **改品牌 = 改一个种子**。`src/styles/design-tokens.ts` 的 `BRAND_PRIMARY` 是唯一入口：浅/深两套颜色与 hover、浅色底由 antd 官方算法派生，`applyTheme()` 在 `createRoot` 前把 `--color-*` 写进 `documentElement`。antd 组件与 Tailwind 壳读同一次计算结果。
   - `src/styles/design-tokens.ts` —— 品牌种子 + CSS 变量注入（改这里）
   - `src/styles/antd-theme.ts` —— 把同一种子交给 `ConfigProvider`
   - `src/styles/index.css` —— `@theme inline` 把变量映射为 Tailwind 主题类
   - `src/styles/tokens.css` —— 只放非颜色令牌（color-scheme / 滚动条 / 语法高亮）
4. **antd 组件样式只经 `antd-theme.ts` / `ConfigProvider`**：不写 `:global` 覆盖，不在组件里散落 antd 样式补丁。
5. **深浅色**：`applyTheme()` 统一切换 `data-theme`、`.dark` class 与颜色变量；`useTheme` 负责在 OS 偏好变化时重算。组件内不读 `prefers-color-scheme`。

## 指针

- 品牌色唯一真源：`src/styles/design-tokens.ts` 的 `BRAND_PRIMARY`。本文不复制色板（避免双源漂移）。
- 品牌定制（换 logo / 主色 / 应用名）入口：[配置项归属（Configuration-map）](../../docs/src/pages/dx/configuration-map.md)。
