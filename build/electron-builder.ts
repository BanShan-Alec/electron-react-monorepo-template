import fs from 'node:fs';
import { join } from 'node:path';
import type { Configuration } from 'electron-builder';
import { APP_IDENTITY } from './lib/app-identity';

// 基于当前构建脚本目录确定全局确定的根目录
const ROOT_DIR = join(__dirname, '..');

// 应用身份与 OTA 仓库坐标唯一事实源：根目录 package.json（不接受 .env 覆盖）
// repository.url 缺失时使用 'local' / 'app' 占位，保证更新元数据生成且绝不阻断打包
const resolvedOwner = APP_IDENTITY.repositoryOwner || 'local';
const resolvedRepo = APP_IDENTITY.repositoryName || 'app';

const config: Configuration = {
  appId: APP_IDENTITY.appId,
  productName: APP_IDENTITY.productName,
  directories: {
    output: 'dist',
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
    shortcutName: APP_IDENTITY.productName,
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
