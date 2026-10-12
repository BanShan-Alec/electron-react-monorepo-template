# 多窗口与 MPA (Multi-Page Application) 架构开发指南

> 本文系统介绍项目的前端多页面架构（MPA）、多窗口管理器（`WindowManager`）以及如何快速新增一个独立的 Electron 窗口。

---

## 1. 为什么选择 MPA 而非单页 Hash 路由

在很多初级 Electron 模板中，多窗口通常使用 SPA Hash 路由（如 `index.html#/settings`）共享同一个前端 HTML 入口。本项目坚决裁决并采用 **Vite MPA 架构**：

1. **极致的内存隔离**：每个窗口加载独立的 HTML 与独立 JS 运行时上下文，窗口关闭时 V8 堆内存立即由垃圾回收器释放，不存在单页全局 Store/DOM 泄漏；
2. **构建产物按需分割**：更新窗口（`updater`）仅需极小 Bundle，无需打包主界面庞大的 Ant Design 样式与图表库；
3. **独立的安全策略**：不同入口可配置独立的 CSP（内容安全策略）与特定 Preload。

---

## 2. 既有多窗口架构剖析

项目默认内置两个物理窗口：

```text
packages/renderer/
  ├── src/
  │    ├── entries/
  │    │    ├── home/             # 主工作台窗口
  │    │    │    ├── index.html
  │    │    │    └── main.tsx
  │    │    └── updater/          # 独立更新升级窗口
  │    │         ├── index.html
  │    │         └── main.tsx
```

- **主进程调度中心**：`packages/main/src/modules/window/window.manager.ts`
- **构建映射**：`packages/renderer/vite.config.ts` 中的 `rollupOptions.input`：
  ```ts
  rollupOptions: {
    input: {
      home: path.resolve(currentDir, 'src/entries/home/index.html'),
      updater: path.resolve(currentDir, 'src/entries/updater/index.html'),
    },
  }
  ```

---

## 3. 新增一个独立窗口的完整操作步骤

假设我们需要新增一个独立的 `settings`（偏好设置）窗口：

### 步骤 1：在 Renderer 创建前端入口
1. 创建目录 `packages/renderer/src/entries/settings/`；
2. 新增 `index.html`：
   ```html
   <!DOCTYPE html>
   <html lang="zh-CN">
     <head>
       <meta charset="UTF-8" />
       <title>设置 - Preferences</title>
     </head>
     <body>
       <div id="root"></div>
       <script type="module" src="./main.tsx"></script>
     </body>
   </html>
   ```
3. 新增 `main.tsx`：挂载 React 根节点与对应视图组件。

### 步骤 2：注册 Vite 构建入口
在 `packages/renderer/vite.config.ts` 的 `rollupOptions.input` 追加：
```ts
input: {
  home: path.resolve(currentDir, 'src/entries/home/index.html'),
  updater: path.resolve(currentDir, 'src/entries/updater/index.html'),
  settings: path.resolve(currentDir, 'src/entries/settings/index.html'), // 👈 新增
}
```

### 步骤 3：在主进程 `WindowManager` 注册窗口管理逻辑
编辑 `packages/main/src/modules/window/window.manager.ts`：
1. 扩充窗口类型枚举或标识；
2. 封装 `createSettingsWindow()`：
   - 配置窗口初始宽高（如 `600x450`）、无边框/标题栏样式；
   - 生产模式使用 `file://` 协议加载 `packages/renderer/dist/src/entries/settings/index.html`；
   - 开发模式加载 `http://localhost:<PORT>/src/entries/settings/index.html`。
3. 挂载日志实例：调用 `logManager.getWindowLogger('settings')` 自动生成隔离的 `renderer-settings.log`。

### 步骤 4：通过 IPC 触发打开或激活
在 `@app/shared` 声明打开设置通道，主进程 Controller 响应并调用 `windowManager.createSettingsWindow()`。若窗口已存在，则调用 `window.focus()` 唤醒前置。
