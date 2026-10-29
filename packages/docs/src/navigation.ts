export type NavigationItem = { text: string; link: string };
export type NavigationGroup = { text: string; collapsed: boolean; items: NavigationItem[] };

/**
 * 文档站导航的单一真源。
 * vocs.config.ts 消费它生成侧栏；首页 PageDirectory 消费同一份数据生成目录。
 * 新增页面只改这里，侧栏与首页同时生效。
 */
export const SIDEBAR_GROUPS: NavigationGroup[] = [
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
      { text: '国际化（i18n）', link: '/ui/i18n' },
      { text: '国际化文案规范（Copy）', link: '/ui/i18n-copy' },
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
];

export const SIDEBAR = { '/': SIDEBAR_GROUPS };
