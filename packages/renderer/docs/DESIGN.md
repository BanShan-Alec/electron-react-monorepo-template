# DESIGN.md — renderer 视觉规范（纪律与指针）

AI 在 renderer 写样式时唯一需要遵守的视觉纪律；品牌定制入口见文末。本文**不复制色板**——颜色真源在代码里（见指针）。

## 纪律

1. **禁硬编码颜色 / 间距 / 字体值**：一律使用 `var(--color-*)` CSS 变量或 Tailwind 主题类（`bg-primary`、`text-foreground` 等）。
2. **改品牌 = 改 token，不改组件**。三个文件各司其职：
   - `src/styles/tokens.css` —— CSS 变量唯一定义（改这里）
   - `src/styles/index.css` —— `@theme inline` 把 token 映射为 Tailwind 主题类
   - `src/styles/antd-theme.ts` —— antd 侧的主题镜像
3. **antd 组件样式只经 `antd-theme.ts` / `ConfigProvider`**：不写 `:global` 覆盖，不在组件里散落 antd 样式补丁。
4. **深浅色**：由 `@custom-variant dark`（class 机制）+ `documentElement.dataset.theme` 驱动（`useTheme` 同步 `.dark` class 与 OS 偏好），不在组件里读 `prefers-color-scheme` 自行判断。

## 指针

- 当前品牌色值以 `src/styles/tokens.css` 为唯一真源，本文不复制色板（避免双源漂移）。
- 品牌定制（换 logo / 主色 / 应用名）入口：[docs/template-customization-guide.md](../../../docs/template-customization-guide.md)。
