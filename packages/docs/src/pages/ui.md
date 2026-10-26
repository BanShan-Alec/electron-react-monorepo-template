# 界面与交互

界面、可观测性、桌面原生能力三块现成基建，拿来即用。本维度收录界面与交互这一块；可观测性与桌面原生能力见 [主进程运行时](/main)。

## 要解决的坑

**界面与交互**：Electron 渲染层就是一张网页，但组件库、样式方案、i18n、路由、状态管理每样都要选型拼装，选错组合就互相打架——antd 的组件样式和 Tailwind 工具类互刷特异性、i18n 的 key 散落在代码里对不上文案、打包后页面从 `file://` 加载导致浏览器那套路由直接失效、状态管理嵌套 Provider 地狱。再加上一个 Electron 特有问题：React 挂载完成之前窗口就是白的，首屏白屏期想藏都藏不住。

## 收录的解法

- [组件库（antd）](/ui/antd)：五层 Provider 装配与主题算法，颜色令牌交给 antd 官方算法输出。
- [样式与令牌（Tailwind v4）](/ui/tailwind)：层序声明 + `@theme inline` + tokens.css，工具类与 antd 组件读同一组变量。
- [国际化（Lingui）](/ui/lingui)：源码即 key，中文直写，构建期抽词条、运行时按语种动态加载。
- [路由（wouter）](/ui/wouter)：hash 路由适配 `file://`，根路径与未知路径统一收敛。
- [全局状态（zustand）](/ui/zustand)：单一无 Provider 的 store，主题与语言按字段订阅。
- [错误边界（ErrorBoundary）](/ui/error-boundary)：接住渲染异常，兜底 UI + 三路上报 + 一键恢复。
- [首屏体验（启动编排）](/ui/first-screen)：动画、React 首帧、主进程就绪三路门禁，齐备才揭幕。
- [原生窗口体验（WCO）](/ui/wco)：系统标题栏让位但窗口管理仍归操作系统，overlay 与窗口底色同源防白闪。
