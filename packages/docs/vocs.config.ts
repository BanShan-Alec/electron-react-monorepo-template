import { defineConfig } from 'vocs/config';

export default defineConfig({
  // 注意：必须从 vocs/config 子路径导入。主入口会拉起 React 组件链，
  // 其中的 ~icons 虚拟包在配置加载阶段无法解析（见 packages/docs 迁移记录）。
  basePath: '/electron-react-monorepo-template/',
  title: 'Electron 解决方案合集',
  description: '常见 Electron 坑位的解法目录：每个解法都有本仓库经过发版验证的真实实现可抄',
  // 默认 dynamic 是 Node 服务形态；GitHub Pages 纯静态托管必须显式 full-static
  renderStrategy: 'full-static',
  socials: [
    {
      icon: 'github',
      link: 'https://github.com/BanShan-Alec/electron-react-monorepo-template',
    },
  ],
  // 维度重组后的旧 URL 重定向（contracts 并入安全与性能；infrastructure 拆为界面与交互、主进程运行时）
  redirects: [
    { source: '/contracts', destination: '/security/ipc-contract', status: 301 },
    { source: '/infrastructure', destination: '/ui', status: 301 },
  ],
  sidebar: {
    '/': [
      {
        text: '工程化基座',
        collapsed: true,
        items: [
          { text: '维度总览', link: '/engineering' },
          { text: '依赖管理（monorepo）', link: '/engineering/dependency-management' },
          { text: '环境变量管理（dotenv）', link: '/engineering/env-vars' },
          { text: '编译配置继承（tsconfig）', link: '/engineering/tsconfig-inheritance' },
          { text: '代码规范与风格（Biome）', link: '/engineering/code-style' },
          { text: '提交信息规范（commitlint）', link: '/engineering/commit-convention' },
        ],
      },
      {
        text: '开发体验',
        collapsed: true,
        items: [
          { text: '维度总览', link: '/dx' },
          { text: '开发编排（Vite + Electron 双进程）', link: '/dx/dev-orchestration' },
          { text: '启动预检（单实例与端口）', link: '/dx/startup-preflight' },
          { text: '远程调试端口（CDP）', link: '/dx/debug-port' },
          { text: '日志与链路排查（用法视角）', link: '/dx/log-troubleshooting' },
        ],
      },
      {
        text: '架构组织',
        collapsed: true,
        items: [
          { text: '维度总览', link: '/architecture' },
          { text: '多窗口入口（MPA）', link: '/architecture/multi-window' },
          { text: '功能域组织（features 目录）', link: '/architecture/feature-domains' },
          { text: '组件目录结构（一组件一文件夹）', link: '/architecture/component-structure' },
          {
            text: 'React 组件编写规范（代码分区与 hooks 约定）',
            link: '/architecture/react-conventions',
          },
          { text: '模块生命周期（ModuleRunner）', link: '/architecture/module-lifecycle' },
          { text: '分层架构（Controller/Service）', link: '/architecture/layering' },
        ],
      },
      {
        text: '界面与交互',
        collapsed: true,
        items: [
          { text: '维度总览', link: '/ui' },
          { text: '组件库（antd）', link: '/ui/antd' },
          { text: '样式与令牌（Tailwind v4）', link: '/ui/tailwind' },
          { text: '国际化（Lingui）', link: '/ui/lingui' },
          { text: '路由（wouter）', link: '/ui/wouter' },
          { text: '全局状态（zustand）', link: '/ui/zustand' },
          { text: '错误边界（ErrorBoundary）', link: '/ui/error-boundary' },
          { text: '首屏体验（启动编排）', link: '/ui/first-screen' },
          { text: '原生窗口体验（WCO）', link: '/ui/wco' },
        ],
      },
      {
        text: '主进程运行时',
        collapsed: true,
        items: [
          { text: '维度总览', link: '/main' },
          { text: '全链路追踪（W3C trace）', link: '/main/tracing' },
          { text: '本地日志（electron-log）', link: '/main/logging' },
          { text: '崩溃上报（Sentry）', link: '/main/crash-reporting' },
          { text: '托盘常驻与单实例（Tray + 单实例锁）', link: '/main/tray-single-instance' },
          { text: '配置持久化（electron-store）', link: '/main/config-persistence' },
        ],
      },
      {
        text: '安全与性能',
        collapsed: true,
        items: [
          { text: '维度总览', link: '/security' },
          { text: '渲染进程沙箱（contextIsolation + sandbox）', link: '/security/sandbox' },
          { text: '内容安全策略（CSP）', link: '/security/csp' },
          { text: '路径稳健性（模块相对定位）', link: '/security/path-robustness' },
          { text: '分包与体积门禁（asar 硬门禁）', link: '/security/bundle-budget' },
          { text: '类型安全的 IPC 契约（zod + contextBridge）', link: '/security/ipc-contract' },
        ],
      },
      {
        text: '测试矩阵',
        collapsed: true,
        items: [
          { text: '维度总览', link: '/testing' },
          { text: '单元测试（Vitest）', link: '/testing/unit-tests' },
          { text: '主进程单元测试（EventEmitter 打桩）', link: '/testing/main-process-tests' },
          { text: '端到端测试（Playwright）', link: '/testing/e2e-electron' },
          { text: '端到端断言策略（shell 打桩 + 容差）', link: '/testing/e2e-assertions' },
          { text: '性能基线（Vitest benchmark）', link: '/testing/performance-baseline' },
          { text: '产物冒烟测试（dist 启动验证）', link: '/testing/artifact-smoke' },
        ],
      },
      {
        text: '交付门禁',
        collapsed: true,
        items: [
          { text: '维度总览', link: '/delivery' },
          { text: '应用打包（electron-builder）', link: '/delivery/packaging' },
          { text: '源码映射隔离（SourceMap）', link: '/delivery/sourcemap' },
          { text: 'CI 并行门禁（GitHub Actions）', link: '/delivery/ci-gates' },
          { text: '应用更新（electron-updater）', link: '/delivery/auto-update' },
          { text: '发版流水线（changelogen + tag）', link: '/delivery/release-pipeline' },
        ],
      },
      {
        text: 'AI 协同',
        collapsed: true,
        items: [
          { text: '维度总览', link: '/ai' },
          { text: 'AI 评审闭环（OpenCodeReview + pr-review）', link: '/ai/review-loop' },
          { text: 'AI 协作者约定（AGENTS.md 分层与红线）', link: '/ai/collaboration-convention' },
          { text: 'AI 友好代码约定（引用式）', link: '/ai/friendly-conventions' },
        ],
      },
    ],
  },
});
