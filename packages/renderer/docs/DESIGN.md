# DESIGN.md — renderer 视觉规范（纪律与指针）

AI 在 renderer 写样式时唯一需要遵守的视觉纪律；品牌定制入口见文末。本文**不复制色板**——颜色真源在代码里（见指针）。

## 纪律

1. **禁硬编码颜色 / 间距 / 字体值**：一律使用 `var(--color-*)` CSS 变量或 Tailwind 主题类（`bg-primary`、`text-foreground` 等）。
2. **层级秩序**（antd v6 + Tailwind v4 官方配比）：`index.css` 首行声明 `@layer theme, base, antd, components, utilities`，`AppProviders` 用 `<StyleProvider layer>` 把 antd 样式收进 `@layer antd`。覆盖关系只看层：Tailwind utilities 可直接覆盖 antd 组件（写 `className` 即可，无需 `!important`）；自己的组件类进 `components` 层；**不要在层外写裸样式**（无层级样式会压过一切）。唯一豁免：`tokens.css` 的 `:root` 设计令牌定义保持未分层（utilities 不会声明 `--color-*` 变量，无竞争面；未分层反而保证令牌不被 theme 层的回退值覆盖）。
3. **改品牌 = 改 token，不改组件**。三个文件各司其职：
   - `src/styles/tokens.css` —— CSS 变量唯一定义（改这里）
   - `src/styles/index.css` —— `@theme inline` 把 token 映射为 Tailwind 主题类
   - `src/styles/antd-theme.ts` —— antd 侧的主题镜像
4. **antd 组件样式只经 `antd-theme.ts` / `ConfigProvider`**：不写 `:global` 覆盖，不在组件里散落 antd 样式补丁。
5. **深浅色**：由 `@custom-variant dark`（class 机制）+ `documentElement.dataset.theme` 驱动（`useTheme` 同步 `.dark` class 与 OS 偏好），不在组件里读 `prefers-color-scheme` 自行判断。

## 指针

- 当前品牌色值以 `src/styles/tokens.css` 为唯一真源，本文不复制色板（避免双源漂移）。
- 品牌定制（换 logo / 主色 / 应用名）入口：[配置项归属（Configuration-map）](../../docs/src/pages/dx/configuration-map.md)。
