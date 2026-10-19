# 回归原生 file 协议加载与移除自定义特权协议服务

Status: accepted（2026-10-12）
Supersedes: [ADR-0005](0005-custom-protocol-runtime-env-injection.md)

## 背景与演进动因

在 [ADR-0005](0005-custom-protocol-runtime-env-injection.md) 制定初期，架构引入特权自定义协议（`app://`）的核心诉求之一是为了在生产打包态支撑静态资源托管与运行时环境变量无缝注入。然而，随着后续架构的持续重构与深入分析，原有的核心决策前提发生了显著变化：

1. **环境变量分发已彻底与协议层解耦**：
   - 环境变量分发机制已迁移至「Chromium `additionalArguments` 紧凑混淆传参 + Preload 同步解包与冻结挂载 `window.__APP_ENV__`」。
   - 协议层已不再承担 HTML 文本流拦截与占位符动态替换的职责，仅作为单纯的本地文件静态代理。
2. **应用无需复杂的 SPA History 路由回退**：
   - 当前项目采用多窗口架构（`home` 主窗口与 `updater` 弹窗），主界面为基于状态常驻的多面板 Tab 编排，并不依赖基于 Browser History API 的深层页面路径回退。
   - Vite 在打包时统一配置 `base: './'`，所有构建产物均为确定性的相对资源引用。
3. **消除自定义协议的复杂性与运维包袱**：
   - 自定义特权协议引入了额外的 Node.js fs 读取与流转换开销、MIME 字典维护、DevTools 调试限制、Sentry SourceMap 映射规则差异以及潜在的路径遍历防御负担。
   - 回归 Electron 原生 `mainWindow.loadFile()`（即 `file://` 协议）不仅完全满足生产打包运行需求，还能彻底剔除整个 `protocol.module.ts` 基础设施模块，使主进程架构更加精简、轻量、稳定。

---

## 裁决方案核心内容

1. **移除自定义协议模块**：
   - 物理删除 `packages/main/src/modules/protocol.module.ts`；
   - 从主进程启动编排（`initApp`）中移除 `createProtocolModule` 的注册与初始化。
2. **生产态窗口回归原生文件加载**：
   - 主进程窗口配置在非开发模式下直接使用绝对文件路径：
     - 主窗口：`{ path: require.resolve('@app/renderer') }`
     - 更新器窗口：`{ path: require.resolve('@app/renderer/updater.html') }`
   - 由 `WindowManager` 与 `UpdaterWindowModule` 自动调用 Electron 原生 `browserWindow.loadFile(this.renderer.path)`。
3. **安全白名单收敛**：
   - 在 `BlockNotAllowedOrigins` 安全门禁中移除针对 `app://` 的特殊前缀豁免；
   - 内部导航白名单严格收敛为：开发态为 Vite Dev Server 源，生产态为 `file://` 与 `null`，严防未知协议跳转。
4. **保持环境变量机制不变**：
   - 保持基于 Preload 的混淆参数同步解包方案，确保首帧前环境变量安全冻结到位。

---

## 方案收益与优势

- **极致精简**：减少了 140+ 行自定义协议代理代码，无需在主进程常驻自定义网络协议拦截器；
- **原生极致稳定性**：直接利用 Chromium 与 Electron 底层经充分验证的本地文件加载链路与 ASAR 读取能力，无二次流复制和内存开销；
- **调试体验优化**：DevTools 与控制台行为与标准 Electron 官方规范 100% 对齐，无需处理自定义协议在 Network 面板的虚拟模拟耗时问题；
- **全平台一致性**：通过真实打包运行（Smoke Test）验证，Windows / macOS / Linux 解包后首屏秒开，无任何路径或 CORS 兼容性异常。

---

## 边界与约束提示

- **前端资源引用必须保持相对路径**：`packages/renderer/vite.config.ts` 必须严格维持 `base: './'`，确保打包后的 CSS、JS、图片等资源均以相对路径索引，杜绝 `/assets/...` 根绝对路径引用；
- **网络请求严禁使用相对路径**：前端所有对后端业务 API 的请求必须使用包含协议与域名的绝对 URL（如 `https://api.example.com`），不得发出未指明 Host 的相对请求。
