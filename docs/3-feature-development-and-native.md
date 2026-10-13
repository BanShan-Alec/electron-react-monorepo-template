# 阶段三：业务功能与 Native 原生模块

本文档指导你如何新增业务页面、配置多语言国际化，以及引入 C++ 原生模块。

## 1. 解决什么问题

在业务迭代中，开发者经常遇到这三个问题：
- 新增页面时目录混乱，组件、状态和路由缺少统一规范。
- 国际化维护困难，提取翻译词条容易遗漏。
- 引入硬件驱动等 C++ 原生模块时，打包后找不到 `.node` 二进制文件。

本模板提供标准化 Feature 结构与原生依赖自动化方案，解决上述问题。

## 2. 新增业务页面标准流程

渲染进程统一使用特性驱动结构（Feature-driven structure）。

按以下步骤新增一个功能模块：

1. 在 `packages/renderer/src/features/` 下创建功能目录，例如 `device/`。
2. 保持标准子目录结构：
   - `components/`：页面独占 UI 组件。
   - `hooks/`：业务数据请求与逻辑封装。
   - `index.tsx`：特性聚合入口页面。
3. 在 `packages/renderer/src/routes/` 注册路由：
   ```tsx
   <Route path="/device" component={DeviceFeature} />
   ```
4. 如果需要跨组件共享状态，在 `packages/renderer/src/stores/` 中使用 Zustand 定义状态库。

## 3. 多语言国际化 (Lingui v5)

项目使用 Lingui v5 进行国际化。

### 在代码中标记文本
在 React 组件中使用 `t` 宏包裹需要翻译的文本：

```tsx
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

export const MyComponent = () => {
  useLingui(); // 必须调用，保证语言切换时重新渲染
  return <div>{t`设备列表`}</div>;
};
```

### 提取与编译翻译词条
运行以下命令提取和编译翻译文件：

```bash
# 自动扫描所有源文件并生成 PO 文本翻译文件
pnpm i18n:extract

# 将翻译完成的 PO 文件编译为生产环境二进制 JS
pnpm i18n:compile
```

## 4. 引入 C++ Native 原生模块

以引入 USB 硬件通信模块 `usb` 为例：

### 安装依赖到主进程
进入主进程包并安装依赖：
```bash
pnpm --filter @app/main add usb
```

### 原生二进制自动提升原理
在 pnpm 隔离模式下，原生 `.node` 文件位于虚拟目录中。根目录 `.npmrc` 已内置提升规则：
```ini
public-hoist-pattern[]=@node-usb/*
public-hoist-pattern[]=*usb*
```
构建脚本 `build/electron-builder.ts` 会自动将 `**/*.node` 解压到 `app.asar.unpacked` 目录。

## 5. 避坑指南

- 在组件中使用 `t` 宏时，必须同时在组件顶部调用 `useLingui()`。否则切换语言时界面不会自动刷新。
- 新增 C++ 原生依赖时，只能安装在 `@app/main` 包中。严禁将原生依赖安装到渲染进程。
- 检查原生依赖时，如果遇到缺少预编译文件，请在开发机安装 Visual Studio C++ 生成工具或对应平台的构建环境。
