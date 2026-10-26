---
title: 多窗口入口（MPA）
description: "home 与 updater 各有独立 `index.html` 入口，主进程只按 URL 或物理路径加载，更新窗口不背主应用的路由与卡片。"
---

# 多窗口入口（MPA）

> **TL;DR**：home 与 updater 各有独立 `index.html` 入口，主进程只按 URL 或物理路径加载，更新窗口不背主应用的路由与卡片。

## 要解决的坑

Electron 项目最容易长歪的地方就是组织方式：

- 单页应用思维照搬到多窗口：一个更新小弹窗也要背上主应用的路由、状态和全部卡片代码

## 本仓库的解法

### 1. 多窗口物理入口：MPA 双入口，更新窗口独立成页

→ 源码：[packages/renderer/vite.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/vite.config.ts)

```ts
rollupOptions: {
  input: {
    home: path.resolve(currentDir, 'src/entries/home/index.html'),
    updater: path.resolve(currentDir, 'src/entries/updater/index.html'),
  },
  output: {
    chunkFileNames: 'assets/[name]-[hash].js',
    manualChunks(id) {
      if (id.includes('node_modules')) {
        // 1. 最稳定核心运行时：React 系列
        if (id.includes('react') || id.includes('scheduler')) {
          return 'vendor-react';
        }
        // 2. UI 框架：Ant Design 及其样式/图标/底层 RC 库
        if (id.includes('antd') || id.includes('@ant-design') || id.includes('rc-')) {
          return 'vendor-antd';
        }
      }
    },
  },
},
```

Vite 不是 SPA 单入口，而是 MPA 双入口：home 与 updater 各有 `index.html`，源码目录 `src/entries/` 一眼可见「一个窗口一个页面」。`manualChunks` 把 React 与 antd 抽成共享 vendor chunk，两个入口各自只携带自己的业务代码。

窗口加载哪个页面，由主进程在装配期决定：

→ 源码：[packages/main/src/index.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/index.ts)

```ts
initApp({
  windows: {
    home: devServer
      ? new URL('src/entries/home/index.html', devServer)
      : { path: require.resolve('@app/renderer') },
    updater: devServer
      ? new URL('src/entries/updater/index.html', devServer)
      : { path: require.resolve('@app/renderer/updater') },
  },
```

开发态指向 dev server 的 URL，生产态 `require.resolve` 从 renderer 包的 exports 拿打包产物物理路径——主进程只认「物理路径」这一个抽象，不关心页面内部用什么框架：

→ 源码：[packages/renderer/package.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/package.json)

```json
"main": "./dist/src/entries/home/index.html",
"files": [
  "dist/**",
  "package.json"
],
"exports": {
  ".": {
    "default": "./dist/src/entries/home/index.html"
  },
  "./updater": {
    "default": "./dist/src/entries/updater/index.html"
  },
  "./updater.html": {
    "default": "./dist/src/entries/updater/index.html"
  },
  "./package.json": "./package.json"
}
```

更新窗口因此是真正独立的页面：`entries/updater/index.tsx` 只挂 `UpdaterFeature`，不 import 主应用的路由与任何业务卡片。窗口由模块按需创建（`show()` 时才 `createWindow`）、关闭即销毁释放内存，加载同样走 URL / 物理路径二选一。

→ 源码：[packages/renderer/src/entries/updater/index.tsx](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/entries/updater/index.tsx) · [packages/main/src/modules/window/updater-window.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/window/updater-window.module.ts)

设计动机：更新弹窗是一个小状态页面，物理隔离的是两页各自的业务代码——共享的只剩 React/antd vendor chunk；更新窗口的加载失败、窗口生命周期因此都不牵连主应用，反过来主应用改版也不会误伤更新窗口。
