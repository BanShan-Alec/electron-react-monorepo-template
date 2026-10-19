import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { join } from 'node:path';
import type { Configuration } from 'electron-builder';

// 基于当前构建脚本目录确定全局确定的根目录
const ROOT_DIR = join(__dirname, '..');

// 首次克隆守护：若工作区子包尚未编译（如直接运行 electron-builder），自动执行构建
const mainDistPath = join(ROOT_DIR, 'packages', 'main', 'dist', 'index.cjs');
if (!fs.existsSync(mainDistPath)) {
  console.log('⚡ [electron-builder] 检测到工作区子包尚未编译，正在自动执行预热构建...');
  execSync('pnpm -r run build', { stdio: 'inherit' });
}

// 读取根目录 package.json 作为默认事实源
const rootPkgPath = join(ROOT_DIR, 'package.json');
const rootPkg = fs.existsSync(rootPkgPath) ? JSON.parse(fs.readFileSync(rootPkgPath, 'utf8')) : {};

/**
 * 从 GitHub 仓库 URL 中解析 owner 与 repo
 * 支持 https://github.com/owner/repo.git、git@github.com:owner/repo.git 等格式
 */
function parseGitHubRepo(repoUrl?: string): { owner?: string; repo?: string } {
  if (!repoUrl) return {};
  const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  return {};
}

const parsedRepo = parseGitHubRepo(
  typeof rootPkg.repository === 'string' ? rootPkg.repository : rootPkg.repository?.url,
);

// 优先级：.env 环境变量覆盖 > package.json 事实源 > 零配置回退占位
const owner = process.env.GITHUB_OWNER || parsedRepo.owner;
const repo = process.env.GITHUB_REPO || parsedRepo.repo;
const appId =
  process.env.APP_ID || rootPkg.appId || `com.template.${rootPkg.name || 'electron-app'}`;
const productName =
  process.env.APP_NAME || rootPkg.productName || rootPkg.name || 'Electron React Template';

// 未配置时使用 'local' / 'app' 占位，保证更新元数据生成且绝不阻断打包
const resolvedOwner = owner || 'local';
const resolvedRepo = repo || 'app';

const config: Configuration = {
  appId,
  productName,
  directories: {
    output: process.env.DIST_DIR || 'dist',
    buildResources: 'build/resources',
  },
  generateUpdatesFilesForAllChannels: true,
  publish: {
    provider: 'github',
    owner: resolvedOwner,
    repo: resolvedRepo,
    releaseType: 'release',
  },
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    icon: 'build/resources/icon.ico',
  },
  nsis: {
    oneClick: false,
    perMachine: true,
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: productName,
    installerIcon: 'build/resources/icon.ico',
    uninstallerIcon: 'build/resources/icon.ico',
    installerHeaderIcon: 'build/resources/icon.ico',
    deleteAppDataOnUninstall: false,
  },
  mac: {
    target: ['dmg', 'zip'],
    icon: 'build/resources/icon.icns',
  },
  linux: {
    target: ['deb'],
    icon: 'build/resources/icon.png',
  },
  extraResources: [
    {
      from: 'build/resources',
      to: 'buildResources',
      filter: ['**/*'],
    },
  ],
  /**
   * 采用 package.json 的 name (electron-react-monorepo-template)，零空格小写规范
   * 杜绝 GitHub Releases 上传时被自动转换为点号 (.) 导致 latest.yml 校验与下载 404
   */
  // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder placeholder template
  artifactName: '${name}-${version}-${os}-${arch}.${ext}',
  asarUnpack: ['**/*.node'],
  files: [
    'LICENSE*',
    '!node_modules/@app/**',
    ...getListOfFilesFromEachWorkspace(['main', 'preload', 'renderer']),
    '!**/*.map', // 严禁将 SourceMap 源码映射文件打包进 asar，彻底防止源码泄露
    '!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,changelog.md}',
    '!**/node_modules/*/{test,__tests__,tests,docs,example,examples}/**',
    '!**/node_modules/**/*.d.ts',
    '!**/node_modules/**/*.d.cts',
    '!**/node_modules/**/*.d.mts',
  ],
};

export default config;

/**
 * 显式读取指定 workspace 子包的 package.json 中的 files 配置，生成打包匹配规则
 */
function getListOfFilesFromEachWorkspace(
  workspaces: string[],
): Array<{ from: string; to: string; filter: string[] }> {
  const packagesDir = join(ROOT_DIR, 'packages');
  const allFilesToInclude: Array<{ from: string; to: string; filter: string[] }> = [];

  for (const workspace of workspaces) {
    const dirName = workspace.replace(/^@app\//, '');
    const pkgPath = join(packagesDir, dirName, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;

    const workspacePkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const name = workspacePkg.name;
    if (!name) continue;

    if (!Array.isArray(workspacePkg.files) || workspacePkg.files.length === 0) continue;

    allFilesToInclude.push({
      from: `packages/${dirName}`,
      to: `node_modules/${name}`,
      filter: [...workspacePkg.files, '!**/*.map'],
    });
  }

  return allFilesToInclude;
}
