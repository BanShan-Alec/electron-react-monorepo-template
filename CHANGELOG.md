# Changelog


## v1.2.0

[compare changes](https://github.com/BanShan-Alec/electron-react-monorepo-template/compare/v1.1.1...v1.2.0)

### 🚀 新增特性 (Features)

- **ci:** 增加 pr:merge 安全确认守卫并更新面向 AI 的 SOP 规范 ([2494b15](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/2494b15))

### ⚡ 性能优化 (Performance)

- **build:** 缩减 asar 打包体积，去除内联 sourcemap 并剔除冗余依赖 ([#19](https://github.com/BanShan-Alec/electron-react-monorepo-template/pull/19))

### 🤖 持续集成 (CI/CD)

- Release 页中文标题与 CHANGELOG 导航 ([712d475](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/712d475))

### ❤️ Contributors

- Wengzehua ([@BanShan-Alec](https://github.com/BanShan-Alec))
- 半山Alec ([@BanShan-Alec](https://github.com/BanShan-Alec))

## v1.1.1

[compare changes](https://github.com/BanShan-Alec/electron-react-monorepo-template/compare/v1.1.0...v1.1.1)

### 🩹 缺陷修复 (Bug Fixes)

- **main:** 崩溃监听前移至首个 import，接住 import 期异常 ([#17](https://github.com/BanShan-Alec/electron-react-monorepo-template/pull/17))

### ❤️ Contributors

- 半山Alec <627649674@qq.com>

## v1.1.0


### 🚀 新增特性 (Features)

- 初始化项目首次提交 (v1.0.0) ([7b340e6](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/7b340e6))
- 修复主界面滚动并接入系统级主题与平台原生滚动条 ([78d7e1a](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/78d7e1a))
- **renderer:** 接入 Sentry 错误上报并收窄 SourceMap 泄露面 ([1774746](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/1774746))
- **settings:** 修复偏好设置全链路缺陷并集成 LinguiJS 中文优先国际化架构 ([e7eb666](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/e7eb666))
- **shared:** 新增窗口身份定义与更新模块 IPC 类型契约 ([d854f72](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/d854f72))
- **main:** 引入窗口注册中心并规范主窗口更名与生命周期管理 ([12d1e75](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/12d1e75))
- **main:** 实现自动更新状态机服务与独立更新窗口模块 ([3431a85](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/3431a85))
- **main:** 接通托盘检查更新入口并增强外链安全校验 ([bc1d53e](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/bc1d53e))
- **preload:** 暴露 updater 命名空间与安全外链调用能力 ([2c54c9c](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/2c54c9c))
- **renderer:** 抽取 AppProviders 并实现独立更新窗口与功能组件 ([9841465](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/9841465))
- **renderer:** 设置页增加检查更新入口并提取多语言词条 ([8d9724e](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/8d9724e))
- **i18n:** 补全所有业务模块与主进程通知的多语言适配 ([86b676b](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/86b676b))
- **renderer:** 引入 @ant-design/icons 统一卡片图标并优化紧凑按钮尺寸规范 ([e8f7f98](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/e8f7f98))
- **devtools:** 增加非白名单外链安全拦截演示与多语言支持 ([bb09780](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/bb09780))
- **scripts:** 抽离 port-guard 模块并实现开发环境端口占用交互式清理与子进程树强杀 ([bc193cc](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/bc193cc))
- **renderer:** 基于 CSS Custom Highlight API 实现代码片段高亮并在 ArchitectureView 中应用 ([3c1194f](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/3c1194f))
- **window:** 接入 WCO 原生窗口控件叠加层并按平台适配标题栏避让与主题联动 ([020c2e0](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/020c2e0))
- **window:** 废除 ready-to-show 门禁并对齐窗口主题底色与无边框重绘守护 ([fe263d4](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/fe263d4))
- **renderer:** 注入内联启动壳与双门禁就绪协调器 ([ac1cac3](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/ac1cac3))
- **renderer:** 接入 StartupReadyNotifier 并埋设 React 首帧提交标记 ([527342b](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/527342b))
- **ci:** 接入 OpenCodeReview AI 代码审查 ([121a90d](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/121a90d))
- **shared:** 启动就绪契约常量、类型与 IPC 通道入库 ([ca3512c](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/ca3512c))
- **build:** 新增 startup-shell 构建期内联插件，协调器与 Logo 源码外置、index.html 缩为占位符 ([7f232b8](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/7f232b8))
- **main:** ModuleRunner 链接入主进程就绪闩锁，preload 先拉后推桥接 ([006dcd3](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/006dcd3))
- **build:** 启动壳 Logo 换为 Header 同款蓝底白雷电 ([bff0ed9](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/bff0ed9))
- **renderer:** 移除启动壳深色渐变卡片，Logo 即视觉主体 ([55f405d](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/55f405d))
- **renderer:** 启动壳 Logo 放大至壳容器满幅 96×96 ([f99deed](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/f99deed))
- PR 工作流命令(scripts/pr.ts)与流程文档成文 ([#12](https://github.com/BanShan-Alec/electron-react-monorepo-template/pull/12))
- **renderer:** 全局自定义滚动条并按主题声明 color-scheme ([#13](https://github.com/BanShan-Alec/electron-react-monorepo-template/pull/13))

### 🩹 缺陷修复 (Bug Fixes)

- **renderer:** 显式传入 linguiConfig 路径以支持从工程根目录启动 dev 开发服务器 ([7a08792](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/7a08792))
- **dialog:** 修复另存为未落盘导致资源管理器定位失效并优化按钮加载态 ([28852a4](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/28852a4))
- **e2e:** 修复 dialog mock 类型不符并补齐 e2e 类型检查覆盖 ([cf4a592](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/cf4a592))
- **dev:** MODE 改由 cross-env 注入并新增 start:dist；lingui 升 6.9 启用原生宏转换 ([9ca92a9](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/9ca92a9))
- **ci:** PR 模板回归单文件形态,修复正文不自动预填 ([edd6b55](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/edd6b55))
- **e2e:** 增强 fixture 退出清理逻辑,增加超时兜底与强杀保护避免 CI teardown 挂起 ([caa01db](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/caa01db))
- **e2e:** 修复 CI 外部进程唤起与 Worker 退出挂起超时问题 ([c3fbed4](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/c3fbed4))
- **startup:** 落实双轴代码审查修正——激活就绪推送腿并加固内联插件 ([bd5a3f6](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/bd5a3f6))
- **scripts:** 门禁只看 required checks,信息性失败不挡合并 ([#14](https://github.com/BanShan-Alec/electron-react-monorepo-template/pull/14))

### 💅 代码重构 (Refactoring)

- **build:** 移除冗余的 maintainer 配置以统一收拢于 package.json ([2b97619](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/2b97619))
- **preload:** 精简双出口与虚拟模块机制，收敛为单一出口 ([9e344be](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/9e344be))
- **shared:** 规范化分层架构与领域切分并沉淀架构规范文档 ([0b98256](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/0b98256))
- 移除 electron-devtools-installer 与冗余依赖 ([d0800e7](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/d0800e7))
- **shared:** 移除桶文件改用子路径导出，17 个消费方直达导入 ([7ec0171](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/7ec0171))
- **renderer:** 移除 16 个桶文件，App 与消费方改为直达具体文件导入 ([74d72f1](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/74d72f1))
- **main:** 移除 modules 与 security 桶、入口零消费者再导出，controllers 与 security 改直达导入 ([7e7c86f](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/7e7c86f))
- **renderer:** 全面迁移 Ant Design v6 并对齐 7 段式组件模板 ([40124a3](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/40124a3))
- **renderer:** 引入 useManualRequest manual-only 封装并迁移全部请求 Hook ([1e0002c](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/1e0002c))
- **renderer:** 统一 IPC 请求层，新增 useIpc 与 callIpc ([a4f01cb](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/a4f01cb))
- **renderer:** Feature 入口化并将 hook 实例化收敛到域内 ([d208108](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/d208108))
- **renderer:** 拆分 diagnostics 与 system-info 为四个平级 feature ([de8a818](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/de8a818))
- **logging:** 规范化日志前缀、消除通道割裂并沉淀工程审查指南 ([6d49b22](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/6d49b22))
- **main:** 将原生 Hash 符号 (#) 私有成员重构为 private 关键字 ([a47d58b](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/a47d58b))
- **main:** 移除 HardwareAccelerationModule 恢复系统默认硬件加速 ([a60aa2a](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/a60aa2a))
- **renderer:** 重构 CodeHighlight 为自包含内聚模块并清理冗余全局类型 ([4ed4e6f](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/4ed4e6f))
- **renderer:** 全部组件统一迁移为一组件一文件夹形态 ([7eac1dd](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/7eac1dd))
- **tsconfig:** 根/e2e/scripts 三处配置收敛到 @app/tsconfig ([c7096c3](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/c7096c3))
- **renderer:** ErrorBoundary 并入 layout 分类，删除 feedback 目录 ([533b2e8](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/533b2e8))
- **ci:** 重构 workflow 体系,救活 CI 门禁并收敛发布管线 ([1a49d24](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/1a49d24))
- **ci:** Setup-env 移除 pnpm store 缓存,步骤回归自然顺序 ([3f9ec9e](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/3f9ec9e))
- **ci:** 移除 Semantic PR 标题校验门禁 ([a520559](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/a520559))
- **build:** 启动壳 Logo 改用 public/favicon.svg 并删除独立 logo.svg ([b8056ec](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/b8056ec))
- **build:** Logo 读取去掉 mtime 缓存，直读+剥除即可 ([81cfa07](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/81cfa07))
- **renderer:** 内联插件迁入 plugins/ 目录并收敛构建工具归属 ([9b81f25](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/9b81f25))
- **build:** 删打包缓存、build 开 minify、Logo 原文直读 ([d38f97d](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/d38f97d))

### 📖 文档更新 (Documentation)

- 落地下沉桶文件禁令与再引入流程，补充执行记录 ([612f4e8](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/612f4e8))
- **shared:** 同步去桶化后的 README——子路径导出替代根入口，移除 index.ts 与 export * 示例 ([0ec9323](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/0ec9323))
- 修正根 README IPC 契约示例与 TODO 失效链接，补桶文件禁令指引 ([9350c53](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/9350c53))
- 补充贡献规范并同步 pnpm 隔离布局表述 ([b69bbc6](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/b69bbc6))
- **renderer:** 重写 README 并沉淀 feature 分层规范 ([bd1cf17](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/bd1cf17))
- 重构根目录 README 为架构全景枢纽并补齐与关联各子包规范 ([c008e84](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/c008e84))
- **i18n:** 新增国际化全链路工程架构设计与开发者实操 SOP 手册 ([dc0fc8c](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/dc0fc8c))
- 完善根目录与渲染进程 README，补充多语言架构索引、SOP 与 E2E 测试指令 ([9165513](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/9165513))
- 简化 README 中关于 i18n 的介绍，收敛并直接指向 docs 文档 ([610a862](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/610a862))
- **spec:** 更新自动更新功能规格说明书为 v2 版本 ([36239c1](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/36239c1))
- **renderer:** 组件组织规则改写为一组件一文件夹并同步桶文件禁令澄清 ([9baf49f](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/9baf49f))
- **specs:** 新增首屏渐进式加载规范与 ADR-0001 窗口材质裁决 ([ed57467](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/ed57467))
- **window:** 新增 WCO 原生标题栏跨项目接入指南 ([00d4ffc](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/00d4ffc))
- **review:** 落实双轴代码审查修正 ([4955900](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/4955900))
- **ci:** 流程指南改名 CICD.md,让出仓库主页 README 显示权 ([2b55c9c](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/2b55c9c))
- **e2e:** 补充主进程全局 shell mock 原因与背景说明 ([395e02a](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/395e02a))
- **specs:** 首屏规范升版 v2——构建期内联与门禁注册表，新增 ADR-0002/0003 与工具链时代规则 ([1d131ea](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/1d131ea))
- **specs:** 新增客户端日志与异常防护整改规范 ([69b66b7](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/69b66b7))

### 🏡 工程维护 (Chores)

- **lint:** 开启 noBarrelFile/noReExportAll/noImportCycles 三条规则为 error 并清理冗余导入 ([45f2ddb](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/45f2ddb))
- 切换 pnpm isolated 布局并更新工程配置与依赖 ([8cf19e3](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/8cf19e3))
- **lint:** 禁止直连 ahooks useRequest 并落地 manual-only 约束文档 ([0c6e578](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/0c6e578))
- **dev:** 重构 dev 脚本与端口机制并统一 configLoader 为 bundle ([85dd836](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/85dd836))
- 清理调试链路死引用与 playwright 依赖 ([a87d9a1](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/a87d9a1))
- **docs:** 移除 docs 目录并修复文档死引用 ([ef6b855](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/ef6b855))
- **updater:** 移除已完结的更新器规范文档 ([af3ff5e](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/af3ff5e))
- **github:** Update LLM API configuration to use secrets ([ced1baf](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/ced1baf))
- **e2e:** Shell 空实现中加入日志记录 ([c1f361d](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/c1f361d))
- 新增 ZCode 工作区忽略配置（同步自 .gitignore） ([fee080f](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/fee080f))

### ✅ 测试相关 (Testing)

- 引入 Playwright E2E 自动化测试套件与初始失败用例 ([27201ca](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/27201ca))
- **e2e:** 增加自动更新模块 6 大场景自动化测试用例 ([1a0c28a](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/1a0c28a))
- **e2e:** 新增 first-screen 用例并回归既有套件 ([9b40a25](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/9b40a25))
- **e2e:** 新增主进程就绪快照断言并全量回归 ([14ef477](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/14ef477))

### 🎨 代码风格 (Styles)

- 清理存量 lint 报错(未用常量与 CSS 缩进) ([66566ca](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/66566ca))

### 🤖 持续集成 (CI/CD)

- 接入自动化跨平台打包工作流并配置 author 为 BanShan-Alec ([1701328](https://github.com/BanShan-Alec/electron-react-monorepo-template/commit/1701328))

### ❤️ Contributors

- 半山Alec <627649674@qq.com>
- Wengzehua <627649674@qq.com>

