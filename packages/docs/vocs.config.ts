import { defineConfig } from 'vocs/config';
import { BASE_PATH, SIDEBAR } from './src/navigation';

export default defineConfig({
  // 注意：必须从 vocs/config 子路径导入。主入口会拉起 React 组件链，
  // 其中的 ~icons 虚拟包在配置加载阶段无法解析（见 packages/docs 迁移记录）。
  basePath: BASE_PATH,
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
  sidebar: SIDEBAR,
});
