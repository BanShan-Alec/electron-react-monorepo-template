import { PROJECT_DOCS_URL } from './docs';

/**
 * 应用展示元数据单一事实源（更新窗口「关于」区消费）。
 *
 * - 值手工同步自根 `package.json`（name/productName/author/license/repository）；
 *   fork 改名时须与本文件同步，同步义务已登记在文档站「配置项归属」页。
 * - `repositoryUrl` 为去 `.git` 后缀的 https 形式，便于派生 releases/issues 坐标；
 * - 版本号不在此处：打包后主进程 `app.getVersion()` 才是运行时真值（经快照透传）。
 */
export const APP_INFO = {
  name: 'Electron React Template',
  author: 'BanShan-Alec',
  license: 'Unlicense',
  repositoryUrl: 'https://github.com/BanShan-Alec/electron-react-monorepo-template',
  releasesUrl: 'https://github.com/BanShan-Alec/electron-react-monorepo-template/releases',
  issuesUrl: 'https://github.com/BanShan-Alec/electron-react-monorepo-template/issues',
  docsUrl: PROJECT_DOCS_URL,
} as const;
