# 安全与性能

这个维度不靠自觉：沙箱与 CSP 默认开启，外链与导航走白名单，路径锚定模块自身，asar 体积在打包后有硬门禁——劣化在发布之前就被拦下。

## 收录的解法

- [渲染进程沙箱（contextIsolation + sandbox）](/security/sandbox)：每个 `BrowserWindow` 的 `webPreferences` 写死 Node 关闭、上下文隔离、沙箱与 `webview` 关闭，对外只留 preload 白名单桥。
- [内容安全策略（CSP）](/security/csp)：CSP 响应头统一注入，外链与页面内跳转各有一层白名单，判定只在主进程。
- [路径稳健性（模块相对定位）](/security/path-robustness)：构建脚本与运行期资源都锚定模块自身位置，不依赖 `process.cwd()`。
- [分包与体积门禁（asar 硬门禁）](/security/bundle-budget)：第三方依赖按稳定性分块，打包前校验根依赖、打包后实测 asar 体积，超限即失败。
- [类型安全的 IPC 契约（zod + contextBridge）](/security/ipc-contract)：通道、入参与返回值在 `@app/shared` 定义一次，zod 校验入参，preload 按白名单暴露。

这四道防线全部默认装配，新代码想绕开反而要做额外动作。
