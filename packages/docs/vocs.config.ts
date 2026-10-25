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
  sidebar: {
    '/': [
      { text: '工程化基座', link: '/engineering' },
      { text: '类型安全的跨进程契约', link: '/contracts', badge: '试点' },
      { text: '开发体验', link: '/dx' },
      { text: '架构组织', link: '/architecture' },
      { text: '应用基础设施', link: '/infrastructure' },
      { text: '安全与性能防御', link: '/security' },
      { text: '测试矩阵', link: '/testing' },
      { text: '交付门禁与 AI 协同', link: '/delivery' },
    ],
  },
});
