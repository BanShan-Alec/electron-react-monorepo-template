# 组件库（Antd）

> **TL;DR**：五层 Provider 装配与主题算法，颜色令牌交给 antd 官方算法输出。

→ 源码：[packages/renderer/src/components/layout/AppProviders/index.tsx](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/components/layout/AppProviders/index.tsx)

```tsx
  return (
    <I18nProvider i18n={i18n}>
      {/*
        layer：把 cssinjs 注入的 antd 样式收进 @layer antd（层名由 cssinjs 默认提供），
        配合 index.css 首行的层序声明，使 Tailwind utilities 可直接覆盖 antd 组件样式。
      */}
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
```

五层 Provider 各司其职：`I18nProvider` 挂 Lingui 的 i18n 实例（见[国际化（Lingui）](/ui/lingui)）；`StyleProvider layer` 把 cssinjs 注入的 antd 样式收进 `@layer antd`（让 Tailwind 工具类能直接覆盖组件样式，见[样式与令牌（Tailwind-CSS）](/ui/tailwind)）；`ConfigProvider` 挂主题算法与语言包；`AntdApp` 提供消息/弹窗上下文；`ErrorBoundary` 兜住渲染异常。

主题配置不覆盖颜色类令牌，只调两个尺寸令牌（源文件头注释自称「不覆盖任何设计令牌」，与这两行相抵，以代码为准）：

→ 源码：[packages/renderer/src/styles/antd-theme.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/styles/antd-theme.ts)

```ts
export function getAntdThemeConfig(mode: ThemeMode) {
  return {
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      controlHeightSM: 28,
      paddingInlineSM: 10,
    },
  };
}
```

深浅两套色彩 Token 全部交给 antd 官方算法输出，视觉基线对齐 antd 原版——自定义颜色不写在主题里，而是走 CSS 变量层（见[样式与令牌（Tailwind-CSS）](/ui/tailwind)），antd 升级时视觉不会跑偏。

## 怎么抄

以「新增一个功能页面」为例：

2. **界面**：antd 组件 + Tailwind 语义类排版，文案直接 `t\`中文\``，跑 `pnpm i18n:extract` 抽词条、补 en-US 翻译
4. **主进程交互**：走 [类型安全的 IPC 契约（Zod + ContextBridge）](/security/ipc-contract) 的四步流程；经 `handleTraced` 注册的 IPC 自动获得 span、日志 trace 前缀与 `Result.traceId`，可观测性免费带
