---
title: 组件库（Antd）
description: Ant Design 五层 Provider 装配、StyleProvider layer 与官方色彩算法集成。
---

# 组件库（Antd）

> **TL;DR**：通过标准五层 Provider 链式装配；`StyleProvider layer` 将 antd 样式收纳进 `@layer antd` 解决与 Tailwind 的优先级冲突；深浅色阶完全依托官方算法派生。

## 1. 选型理由

桌面应用开发需要丰富、高质量的底层 UI 控件（表格、树形控件、表单、模态框）。Ant Design 提供了健全的企业级组件生态与完整的暗黑算法体系。

本工程的集成重点在于**解决 CSS-in-JS 样式特异性覆盖难题**与**打通全局色彩派生**。

## 2. 核心配置代码

### 标准五层 Provider 链式装配

→ 源码：[packages/renderer/src/components/layout/AppProviders/index.tsx](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/components/layout/AppProviders/index.tsx)

```tsx
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider i18n={i18n}>
      {/* 核心：将 antd 样式收敛进 @layer antd，允许 Tailwind 工具类正常覆盖 */}
      <StyleProvider layer>
        <ConfigProvider
          button={{ autoInsertSpace: false }}
          theme={getAntdThemeConfig(resolvedTheme)}
          locale={getAntdLocale(language)}
        >
          <AntdApp>
            <ErrorBoundary>{children}</ErrorBoundary>
          </AntdApp>
        </ConfigProvider>
      </StyleProvider>
    </I18nProvider>
  );
}
```

### 官方算法派生与 CSS 变量作用域

→ 源码：[packages/renderer/src/styles/antd-theme.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/styles/antd-theme.ts)

```ts
export function getAntdThemeConfig(mode: ThemeMode): ThemeConfig {
  return {
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    cssVar: { key: CSS_VAR_KEY }, // 'css-var-app'
    token: {
      colorPrimary: BRAND_PRIMARY,
      controlHeightSM: 28, // 桌面紧凑尺寸
    },
  };
}
```

## 3. 桌面端避坑注意事项

- **必须配置 `<StyleProvider layer>`**：
  - Ant Design 默认采用高特异性内联 `<style>` 注入样式，若未开启 `layer`，Tailwind 的常规工具类（如 `p-4`、`bg-red-500`）将因权重不足而无法覆盖 antd 组件的默认样式。配合全局 `@layer theme, base, antd, components, utilities;` 声明方可实现无缝覆盖。
- **全局通知与弹窗上下文（`<AntdApp>`）**：
  - 严禁在 React 树外部裸调 `message.success()` 或 `Modal.confirm()`（会丢失主题与 Context 上下文）。必须统一通过 `const { message, modal } = AntdApp.useApp()` 从上下文中调用。
- **换肤无需逐个手写覆盖**：
  - 修改品牌色仅需修改 `BRAND_PRIMARY` 一处，禁用/Hover/Active/暗黑底色由官方算法自动派生，避免人工调色导致的色阶断层。
