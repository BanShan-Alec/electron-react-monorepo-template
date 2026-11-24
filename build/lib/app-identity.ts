import packageJson from '../../package.json';

/**
 * 应用身份单一事实源解析（根目录 package.json）
 *
 * 构建期基础设施模块，服务四处消费方：
 * - build/electron-builder.ts：安装包命名、快捷方式名、appId、OTA 发布源
 * - packages/main：编译期注入 GitHub 仓库坐标，供未打包形态手动 setFeedURL
 * - packages/renderer：构建期注入窗口标题（productName）与更新窗口「关于」区（APP_DISPLAY）
 * - 单元测试：.config/vitest.config.ts 注入同一份 APP_DISPLAY，与运行期同源
 *
 * .env 不参与身份与仓库坐标——应用名/标识/发布源属于产品身份，跟随代码仓库而非部署环境。
 * JSON 直接静态导入：Vite / tsx / jiti 均在加载期解析，缺失即构建失败，无需运行时容错。
 */
export interface AppIdentity {
  /** package.json name：OTA 产物与小写命名规范 */
  name: string;
  /** package.json version：Sentry release 与构建期注入 */
  version: string;
  /** 桌面展示名：窗口标题、托盘、快捷方式 */
  productName: string;
  /** 应用唯一标识：Windows AUMID、macOS Bundle Identifier */
  appId: string;
  /** GitHub 发布源 owner（由 repository.url 解析，缺失时为空串） */
  repositoryOwner: string;
  /** GitHub 发布源 repo（由 repository.url 解析，缺失时为空串） */
  repositoryName: string;
}

/** 更新窗口「关于」区展示的身份信息（构建期从根 package.json 注入 renderer） */
export interface AppDisplayInfo {
  /** 展示名（取 productName） */
  name: string;
  /** 作者名（author.name） */
  author: string;
  /** 作者主页（author.url） */
  authorUrl: string;
  /** 开源协议（license） */
  license: string;
  /** 仓库地址（repository.url 去 .git 后缀） */
  repositoryUrl: string;
}

const rootPkg = packageJson as {
  name?: string;
  version?: string;
  productName?: string;
  appId?: string;
  license?: string;
  author?: string | { name?: string; url?: string; email?: string };
  repository?: string | { url?: string };
};

/** 展示字段缺失即构建失败：宁可打包当场报错，也不要发出一个「关于」页空白/错名的安装包 */
function requireDisplayField(value: string | undefined, field: string, hint: string): string {
  if (!value) {
    throw new Error(`[app-identity] 根 package.json 缺少 ${field}（${hint}）`);
  }
  return value;
}

/**
 * 从 GitHub 仓库 URL 中解析 owner 与 repo
 * 支持 https://github.com/owner/repo.git、git@github.com:owner/repo.git 等格式，
 * repo 名允许包含点号（GitHub 允许），并容忍尾部斜杠。
 */
export function parseGitHubRepo(repoUrl?: string): { owner?: string; repo?: string } {
  if (!repoUrl) return {};
  const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  return {};
}

const repositoryUrl =
  typeof rootPkg.repository === 'string' ? rootPkg.repository : rootPkg.repository?.url;
const { owner, repo } = parseGitHubRepo(repositoryUrl);

const productName = rootPkg.productName || rootPkg.name || 'Electron React Template';

/** 仓库展示地址：去 `.git` 后缀与尾部斜杠，保证 releases/issues 子路径拼接稳定 */
const normalizeRepositoryUrl = (url: string): string =>
  url.replace(/\.git\/?$/i, '').replace(/\/$/, '');

/** 作者信息既接受 `author: "Name"` 的简写，也接受 npm 标准对象形态 */
const authorName = typeof rootPkg.author === 'string' ? rootPkg.author : rootPkg.author?.name;
const authorUrl = typeof rootPkg.author === 'string' ? undefined : rootPkg.author?.url;

/**
 * 更新窗口「关于」区展示信息：单一事实源为根 package.json，
 * 经 vite `define` 以 `__APP_INFO__` 注入（值在构建期定型，运行时不再拼接字符串）。
 */
export const APP_DISPLAY: AppDisplayInfo = {
  name: productName,
  author: requireDisplayField(authorName, 'author.name', '更新窗口「开发者」一行取此值'),
  authorUrl: requireDisplayField(authorUrl, 'author.url', '更新窗口「开发者」链接取此值'),
  license: requireDisplayField(rootPkg.license, 'license', '更新窗口「许可证」一行取此值'),
  repositoryUrl: normalizeRepositoryUrl(
    requireDisplayField(repositoryUrl, 'repository.url', '更新窗口「开源仓库」与 OTA 发布源取此值'),
  ),
};

export const APP_IDENTITY: AppIdentity = {
  name: rootPkg.name || 'electron-app',
  version: rootPkg.version || '1.0.0',
  productName,
  appId: rootPkg.appId || `com.template.${rootPkg.name || 'electron-app'}`,
  repositoryOwner: owner || '',
  repositoryName: repo || '',
};
