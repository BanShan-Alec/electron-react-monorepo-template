---
title: 原生窗口体验（WCO）
description: 系统标题栏让位但窗口管理仍归操作系统，overlay 与窗口底色同源防白闪。
---

# 原生窗口体验（WCO）

> **TL;DR**：系统标题栏让位但窗口管理仍归操作系统，overlay 与窗口底色同源防白闪。

## 要解决的坑

自定义标题栏通常意味着 `frame: false` 全自绘：Win11 贴靠、最大化动画、系统菜单全部失守，窗口底色与标题栏色值不同源时还会白闪。

## 本仓库的解法

### 平台分支启用 WCO

→ 源码：[packages/main/src/modules/window/index.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/window/index.module.ts)

Window Controls Overlay：系统标题栏让位给内容，但窗口管理仍归操作系统——Win11 贴靠、最大化动画、系统菜单全部保留。平台分支参照 VS Code 的做法：

```ts
backgroundColor: getWindowBackgroundColor(),
// ...
...(isMac ? { titleBarStyle: 'hidden', titleBarOverlay: true } : {}),
...(isWin
  ? {
      titleBarStyle: 'hidden',
      frame: false,
      titleBarOverlay: getTitleBarOverlayOptions(),
    }
  : {}),
```

- **win32**：`hidden + frame:false` 启用 WCO，overlay 颜色随主题；运行时主题切换经 `setTitleBarOverlay` 同步（→ 源码：[packages/main/src/modules/native-theme.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/native-theme.module.ts) 监听 `nativeTheme.updated`）
- **darwin**：`titleBarOverlay: true` 仅用于启用 WCO JS API 与 CSS `env(titlebar-area-*)`，红绿灯外观由系统管理（构造项的 color/symbolColor 在 darwin 平台无效）
- **linux**：保持系统默认边框，不做定制

### overlay 与窗口底色同源防白闪

overlay 与窗口底色同源同分支，这是防白闪的关键：

→ 源码：[packages/main/src/modules/window/titlebar-overlay.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/window/titlebar-overlay.ts)

```ts
export function getWindowBackgroundColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#141414' : '#ffffff';
}

/** overlay 颜色与 tokens.css 主题变量对齐（浅色 #ffffff/#141414 容器底色 + 主文字色） */
export function getTitleBarOverlayOptions(): { color: string; symbolColor: string } {
  const shouldUseDarkColors = nativeTheme.shouldUseDarkColors;
  return {
    color: getWindowBackgroundColor(),
    symbolColor: shouldUseDarkColors ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.88)',
  };
}
```

`backgroundColor` 在渲染进程起来之前就生效，首帧看到的就是主题底色而非白屏。这对色值与 tokens.css 的容器底色变量同值对齐（`--color-bg-container`：浅 #ffffff / 暗 #141414）——源码注释自己写明「overlay 颜色与 tokens.css 主题变量对齐」；「严禁在别处硬编码」约束的是主进程 JS 侧：这对色值只在 titlebar-overlay.ts 一处计算，别处不得再写死。窗口位置与尺寸的记忆与首启计算见[窗口位置与尺寸（Window-state）](/ui/window-state)。

## 注意点

- WCO 与窗口底色的色值只在 `titlebar-overlay.ts` 一处计算；tokens.css 的容器底色变量与之同值属正常对齐，主进程 JS 里再硬编码同色值才算违规
