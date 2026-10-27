import { defineConfig } from 'vocs/config';

export default defineConfig({
  // 注意：必须从 vocs/config 子路径导入。主入口会拉起 React 组件链，
  // 其中的 ~icons 虚拟包在配置加载阶段无法解析（见 packages/docs 迁移记录）。
  basePath: '/electron-react-monorepo-template/',
  // 站点品牌 = 根 package.json 的 productName；改动时两处须同步
  title: 'Electron React Template',
  description: '常见 Electron 坑位的解法目录：每个解法都有本仓库经过发版验证的真实实现可抄',
  // favicon 共用应用图标。注意：iconUrl 是原样引用、不会自动补 basePath，子路径部署必须带前缀。
  // 不配 logoUrl：Logo 组件配了它就只渲染图不渲染文字，导航栏会剩一颗孤立小图标、
  // 与侧栏 _slots.tsx SidebarHeader 的「图+品牌名」行重叠；品牌展示统一交给 SidebarHeader。
  iconUrl: '/electron-react-monorepo-template/icon.png',
  // 默认 dynamic 是 Node 服务形态；GitHub Pages 纯静态托管必须显式 full-static
  renderStrategy: 'full-static',
  socials: [
    {
      icon: 'github',
      link: 'https://github.com/BanShan-Alec/electron-react-monorepo-template',
    },
  ],
  // 注意：不配 redirects——它是 waku 运行时中间件，full-static 部署（GitHub Pages）执行不到；
  // 旧 URL 跳转必须用 public/<path>/index.html 物理跳转页（见 public/*/index.html）。
  sidebar: {
    '/': [
      {
        text: '前言',
        collapsed: false,
        items: [
          { text: '什么是解决方案合集（Introduction）', link: '/introduction/what-is-this' },
          { text: '快速上手（Getting Started）', link: '/introduction/getting-started' },
          { text: '与 AI 协作（Agent-ready）', link: '/introduction/ai-collaboration' },
        ],
      },
      {
        text: '工程化基座',
        collapsed: true,
        items: [
          { text: '依赖管理（Monorepo）', link: '/engineering/dependency-management' },
          { text: '环境变量管理（Dotenv）', link: '/engineering/env-vars' },
          { text: '编译配置继承（Tsconfig）', link: '/engineering/tsconfig-inheritance' },
          { text: '代码规范与风格（Biome）', link: '/engineering/code-style' },
          { text: '提交信息规范（Commitlint）', link: '/engineering/commit-convention' },
        ],
      },
      {
        text: '开发体验',
        collapsed: true,
        items: [
          { text: '开发编排（Vite + Electron）', link: '/dx/dev-orchestration' },
          { text: '启动预检（Single-instance + Port）', link: '/dx/startup-preflight' },
          { text: '远程调试端口（CDP）', link: '/dx/debug-port' },
          { text: '日志与链路排查（Usage）', link: '/dx/log-troubleshooting' },
          { text: '配置项归属（Configuration-map）', link: '/dx/configuration-map' },
        ],
      },
      {
        text: '架构组织',
        collapsed: true,
        items: [
          { text: '多窗口入口（MPA）', link: '/architecture/multi-window' },
          { text: '功能域组织（Features）', link: '/architecture/feature-domains' },
          { text: '组件目录结构（Component-folder）', link: '/architecture/component-structure' },
          {
            text: 'React 组件编写规范（Code-partition + Hooks）',
            link: '/architecture/react-conventions',
          },
          { text: '模块生命周期（ModuleRunner）', link: '/architecture/module-lifecycle' },
          { text: '分层架构（Controller / Service）', link: '/architecture/layering' },
        ],
      },
      {
        text: '界面与交互',
        collapsed: true,
        items: [
          { text: '组件库（Antd）', link: '/ui/antd' },
          { text: '样式与令牌（Tailwind-CSS）', link: '/ui/tailwind' },
          { text: '国际化（Lingui）', link: '/ui/lingui' },
          { text: '路由（Wouter）', link: '/ui/wouter' },
          { text: '全局状态（Zustand）', link: '/ui/zustand' },
          { text: '错误边界（ErrorBoundary）', link: '/ui/error-boundary' },
          { text: '首屏体验（Startup-orchestration）', link: '/ui/first-screen' },
          { text: '原生窗口体验（WCO）', link: '/ui/wco' },
          { text: '窗口位置与尺寸（Window-state）', link: '/ui/window-state' },
        ],
      },
      {
        text: '主进程运行时',
        collapsed: true,
        items: [
          { text: '全链路追踪（W3C-trace）', link: '/main/tracing' },
          { text: '本地日志（Electron-log）', link: '/main/logging' },
          { text: '崩溃上报（Sentry）', link: '/main/crash-reporting' },
          {
            text: '托盘常驻与单实例（Tray + Single-instance）',
            link: '/main/tray-single-instance',
          },
          { text: '配置持久化（Electron-store）', link: '/main/config-persistence' },
        ],
      },
      {
        text: '安全与性能',
        collapsed: true,
        items: [
          { text: '渲染进程沙箱（Sandbox）', link: '/security/sandbox' },
          { text: '内容安全策略（CSP）', link: '/security/csp' },
          { text: '路径稳健性（Relative-path）', link: '/security/path-robustness' },
          { text: '分包与体积门禁（Chunk + Asar）', link: '/security/bundle-budget' },
          { text: '类型安全的 IPC 契约（Zod + ContextBridge）', link: '/security/ipc-contract' },
        ],
      },
      {
        text: '测试矩阵',
        collapsed: true,
        items: [
          { text: '单元测试（Vitest）', link: '/testing/unit-tests' },
          { text: '主进程单元测试（EventEmitter）', link: '/testing/main-process-tests' },
          { text: '端到端测试（Playwright）', link: '/testing/e2e-electron' },
          { text: '端到端断言策略（Shell-stub + Tolerance）', link: '/testing/e2e-assertions' },
          { text: '性能基线（Benchmark）', link: '/testing/performance-baseline' },
          { text: '产物冒烟测试（Dist-smoke）', link: '/testing/artifact-smoke' },
        ],
      },
      {
        text: '交付门禁',
        collapsed: true,
        items: [
          { text: '应用打包（Electron-builder）', link: '/delivery/packaging' },
          { text: '源码映射隔离（Source-map）', link: '/delivery/sourcemap' },
          { text: 'CI 并行门禁（GitHub-Actions）', link: '/delivery/ci-gates' },
          { text: '应用更新（Electron-updater）', link: '/delivery/auto-update' },
          { text: '发版流水线（Changelogen）', link: '/delivery/release-pipeline' },
        ],
      },
      {
        text: 'AI 协同',
        collapsed: true,
        items: [
          { text: 'AI 评审闭环（Open-code-review）', link: '/ai/review-loop' },
          { text: 'AI 协作者约定（Agents.md）', link: '/ai/collaboration-convention' },
          { text: 'AI 友好代码约定（Reference-style）', link: '/ai/friendly-conventions' },
        ],
      },
    ],
  },
});
