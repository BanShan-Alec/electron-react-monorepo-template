# 特权自定义协议 (app://) 替代传统 file 协议与运行时不可变环境注入

Status: superseded by [ADR-0006](0006-return-to-native-file-protocol.md)（2026-10-12）

## 背景与设计初衷

在传统的 Electron 应用架构中，打包后的渲染进程通常通过 `mainWindow.loadFile()`（即原生的 `file://` 协议）加载前端产物。但在现代化复杂桌面应用体系下，`file://` 方案暴露出多项严重的架构缺陷与开发体验瓶颈：

1. **绝对路径与现代前端构建工具断裂**：Vite / Webpack 等工具默认输出根绝对路径（如 `/assets/app.js`）。在 `file://` 协议下，该路径会被 Chromium 错误解析到宿主操作系统的磁盘物理根目录（例如 Windows 下的 `C:\assets\app.js`），迫使前端必须强行配置相对路径 `base: './'`；
2. **现代 SPA History 路由直接失效**：在没有本地 Web 服务的情况下，纯文件路径无法处理类似 `/settings`、`/notes/detail` 等前端深层路由，用户刷新页面或深链接跳转会触发底层的 `ERR_FILE_NOT_FOUND`，迫使架构不得不妥协退化为老旧的哈希路由（`HashRouter`，带有 `/#/`）；
3. **CORS 与 Web 安全上下文受限**：`file://` 协议在浏览器内核中的 Origin 通常为 `null` 或不透明源，导致 Fetch API、Web Worker、WASM 以及本地跨域策略受限，无法享受现代浏览器的标准安全上下文（Secure Context）；
4. **运行时环境变量下发的“两难困境”**：
   - 若通过构建期编译（如 Vite 的 `import.meta.env`），环境变量在打包时被静态硬编码，更换渠道、分发环境或应用名称时必须重新编译；
   - 若通过 Preload 脚本或异步 IPC（如 `ipcRenderer.invoke('get-env')`）在应用启动时索取，会导致渲染层在 React 首帧渲染、Sentry 异常监控初始化、网络客户端装配等阶段面临严重的异步竞态（Race Condition）。

基于上述痛点，本架构在 `protocol.module.ts` 中裁决：**在生产态注册特权自定义协议 `app://`，接管渲染进程的静态资源分发与 SPA 路由支撑；环境变量分发则解耦为通过 Chromium `additionalArguments` 紧凑混淆传参，并由 Preload 在首帧前同步解包注入 `window.__APP_ENV__`。**

---

## 裁决方案核心内容

1. **注册特权模式**：在主进程启动最早期调用 `protocol.registerSchemesAsPrivileged`，为 `app` 方案赋予 `standard`、`secure`、`supportFetchAPI`、`corsEnabled`、`stream` 等完整现代网络特权；
2. **统一入口与安全白名单**：生产态窗口统一加载 `app://bundle/index.html`（或子窗口 `app://bundle/updater.html`），并将主进程网络安全模块的内部白名单严格收敛锁定在 `app://bundle`；
3. **环境变量解耦分发（紧凑元组 + 异或混淆 + Preload 同步注入）**：主进程在创建窗口时，通过 `env-packer.ts` 将环境快照压缩为紧凑元组、异或掩码混淆后以 `--app-meta=<base64url>` 传入 `additionalArguments`。Preload 脚本在页面执行任何脚本前同步解包，并通过 `contextBridge.exposeInMainWorld` 挂载深度冻结的 `window.__APP_ENV__`。彻底消除协议层对 HTML 文本插桩的侵入；
4. **SPA History 路由回退**：请求路径对应目录或不存在且无扩展名时，自动 Fallback 至 `index.html`，完美支持纯路径的 Browser History 路由；
5. **路径穿越防御**：严格通过 `path.relative` 计算校验请求路径是否逃逸出 `rendererDistDir` 边界，拦截任何 `../` 越界访问并返回 `403 Forbidden`。

---

## Considered Options（选型对比）

- **A. 传统 file:// 协议 + HashRouter + 相对路径打包**：侵入业务路由选型，且无法在启动第一毫秒下发动态环境基座——否决；
- **B. 内置本地 HTTP 微型服务器 (localhost:随机端口)**：占用本地网络端口存在冲突风险，易触发系统防火墙网络授权弹窗，且向本机其他非受信进程暴露了本地 HTTP 攻击面——否决；
- **C. 特权自定义协议 (app://) + 命令行混淆传参与 Preload 同步注入（选定）**：无端口占用、统一 Origin 安全沙箱、完美契合现代前端工具链、运行时环境秒级冻结注入，协议层无需操作 HTML 文本流。

---

## Side Effects & Trade-offs（副作用与代价评估）

本方案在带来架构优势的同时，引入了以下明确的副作用与工程边界，维护团队必须充分知悉并在演进中遵守应对准则：

### 1. 主进程 I/O 调度与 V8 内存缓冲
- **现状代价**：当前实现中，静态文件（JS、CSS、图片等）通过 Node.js `fs.promises.readFile` 全量读入内存 Buffer 并包装为 `Response`。当并发请求大量碎资源或单文件体积过大时，会消耗主进程 V8 堆内存并触发 GC；此外，全量返回缺少 HTTP `Range 206` 支持，导致音视频组件无法自由 Seek 拖动进度条；
- **演进对策**：对于非 HTML 的静态资源，后续可演进为 Electron 原生 `net.fetch(pathToFileURL(filePath).toString())`。该方法由 Chromium 底层 C++ 线程以文件流形式直接读取并原生支持 Range 分段，从而消除 Node.js 内存缓冲瓶颈。

### 2. SPA Fallback 机制导致的“伪 200 幽灵错误”
- **隐患细节**：为了支撑前端路由，协议拦截对所有无扩展名的不存在路径统一回退到 `index.html`（状态码 200）。如果前端由于接口拼写错误误向 `app://bundle/api/v1/user` 发起无扩展名的请求，Chromium 会收到一段 HTML 文本而非 404；前端后续执行 `response.json()` 时将报出隐蔽的 `SyntaxError: Unexpected token '<'`；
- **维护红线**：前端网络请求 SDK 必须严格使用绝对的远程 API 地址，严禁混用发向 `app://` 的相对路径。

### 3. Sentry 异常监控与 Source Map 还原偏差
- **隐患细节**：生产环境中报错堆栈的文件 URL 格式为 `app://bundle/assets/index-[hash].js`。若 CI/CD 在通过 `sentry-cli releases files upload-sourcemaps` 上传 Source Map 时未正确配置 `--url-prefix 'app://bundle/assets'` 或通配映射，Sentry 远端将无法精准匹配 map 文件，导致线上异常堆栈无法还原为原始源码；
- **维护要求**：Sentry 上传流程必须维护与自定义协议对齐的 URL 前缀配置。

### 4. 调试体验与 DevTools 面板失真
- **指标失真**：DevTools Network 面板中对于 `app://` 的 Timing 耗时分解（DNS Lookup, Initial Connection, SSL 等）属于虚拟模拟，指标为 0 或显示 Stalled，不能作为标准网络瀑布流的性能分析依据；
- **工具链限制**：DevTools 的 Local Overrides（本地文件覆盖热调试）对自定义协议支持不佳；同时，`app://bundle` 链接无法像普通网页一样复制到宿主操作系统的独立 Chrome 浏览器中单步调试，所有测试必须受限于 Electron 窗口。

### 5. Origin 隔离与多窗口存储陷阱
- **隐患细节**：Chromium 的同源策略严格校验 `协议 + 域名 + 端口`。当前架构统一采用 `app://bundle`。若未来开发者创建新窗口时随意指定了不同 Host（例如 `app://other/index.html`），Chromium 会判定其为异源，导致 LocalStorage、IndexedDB、Cookies 物理隔离，无法跨窗口共享；
- **维护红线**：全局协议 Host 必须恒定锁定为 `bundle`（单一事实源），禁止衍生其他子域名。

### 6. Web 标准 API 与第三方 SDK 限制
- **API 限制**：Service Worker 规范对自定义协议较为苛刻，在某些环境版本下注册可能触发 `SecurityError`；Web Worker 实例化时要求协议必须提供绝对准确的 `text/javascript` MIME 响应头；
- **三方库兼容**：极少数第三方 Web SDK（如某些特定支付/活体验证组件）内部存在 `location.protocol === 'https:'` 的硬编码校验，在 `app://` 下会拒绝运行；此外，标准 OAuth 回调不接收 `app://`，必须配合系统级 Deep Link 或主进程 WebRequest 拦截解决。

---

## 结论与后果（Consequences）

1. `packages/main/src/modules/protocol.module.ts` 作为生产态静态资源分发与 SPA 路由支撑模块，不得随意弱化或拆解；
2. 环境变量通过 `env-packer.ts` 与 `additionalArguments` 在全环境（开发、生产、测试）统一传递，彻底解除协议层与 HTML 占位符的耦合；
3. 路径安全越界防护（`path.relative` 校验）作为安全红线永久保留；
4. 若未来应用引入大型多媒体音视频流，需遵循本文档规划的 `net.fetch` 流式重构路径。
