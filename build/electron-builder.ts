import fs from 'node:fs';
import { join } from 'node:path';
import type { AfterPackContext, Configuration } from 'electron-builder';
import { APP_IDENTITY } from './lib/app-identity';

// 基于当前构建脚本目录确定全局确定的根目录
const ROOT_DIR = join(__dirname, '..');

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
    owner: APP_IDENTITY.repositoryOwner,
    repo: APP_IDENTITY.repositoryName,
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
    // 静默与默认卸载不自动删用户数据；交互式卸载通过 build/installer.nsh 提供可勾选项
    deleteAppDataOnUninstall: false,
    include: 'build/installer.nsh',
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
  /**
   * 目录型构建（build:unpack / 便携分发）没有 nsis 这类 updater-aware target，
   * electron-builder 自带的 app-update.yml 写入逻辑会被跳过，导致打包后的应用
   * 点击「检查更新」时抛 ENOENT。此处对所有打包形态补齐该文件（已存在则不覆盖，
   * 安装包构建由 electron-builder 写入的完整配置优先）。
   */
  afterPack: (context: AfterPackContext) => {
    ensureAppUpdateConfig(context);
  },
  /**
   * Electron Fuses（构建期写入二进制熔丝开关）
   * - runAsNode / enableNodeOptionsEnvironmentVariable：防止客户端被当作通用 Node 运行器或注入 NODE_OPTIONS
   * - onlyLoadAppFromAsar + enableEmbeddedAsarIntegrityValidation：锁死仅从 app.asar 加载并校验完整性（Win/Mac 生效；防篡改需配合 OS 代码签名）
   * - resetAdHocDarwinSignature：无正式 Apple 签名时保证 macOS arm64 修改 Fuse 后仍可正常启动
   * - 未关闭 enableNodeCliInspectArguments：verify-postbuild 依赖 Playwright electron.launch(--inspect=0) 验真；下游发商业签名包时建议设为 false 并改用 CDP 探针
   * - 未开启 enableCookieEncryption：无签名 macOS 下重打包会变更 ad-hoc 签名并触发 Keychain 弹窗，且为单向不可逆迁移
   */
  electronFuses: {
    runAsNode: false,
    enableNodeOptionsEnvironmentVariable: false,
    onlyLoadAppFromAsar: true,
    enableEmbeddedAsarIntegrityValidation: true,
    resetAdHocDarwinSignature: true,
  },
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

const APP_UPDATE_CONFIG_FILE = 'app-update.yml';

/**
 * 写入 electron-updater 运行时读取的 resources/app-update.yml
 * 内容与 electron-builder 为 nsis target 生成的配置保持同构（含 updaterCacheDirName）。
 */
function ensureAppUpdateConfig(context: AfterPackContext): void {
  const resourcesDir = context.packager.getResourcesDir(context.appOutDir);
  const targetPath = join(resourcesDir, APP_UPDATE_CONFIG_FILE);
  if (fs.existsSync(targetPath)) return;

  const { repositoryOwner, repositoryName } = APP_IDENTITY;
  if (!repositoryOwner || !repositoryName) {
    console.warn('[electron-builder] 跳过 app-update.yml 生成：repository.url 未解析出 owner/repo');
    return;
  }

  const entries: Array<[string, string]> = [
    ['provider', 'github'],
    ['owner', repositoryOwner],
    ['repo', repositoryName],
    ['releaseType', 'release'],
    ['updaterCacheDirName', context.packager.appInfo.updaterCacheDirName],
  ];
  fs.mkdirSync(resourcesDir, { recursive: true });
  fs.writeFileSync(targetPath, `${entries.map(([key, value]) => `${key}: ${value}`).join('\n')}\n`);
}

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
