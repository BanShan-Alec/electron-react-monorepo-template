import fs from 'node:fs';
import { join } from 'node:path';
import type { Configuration } from 'electron-builder';

// 读取根目录 package.json 作为默认事实源
const rootPkgPath = join(__dirname, '../package.json');
const rootPkg = fs.existsSync(rootPkgPath) ? JSON.parse(fs.readFileSync(rootPkgPath, 'utf8')) : {};

// 优先级：.env 环境变量覆盖 > package.json 事实源 > 零配置回退占位
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const appId = process.env.APP_ID || rootPkg.appId || `com.template.${rootPkg.name}`;
const productName = process.env.APP_NAME || rootPkg.productName || rootPkg.name;

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
   * It is recommended to avoid using non-standard characters such as spaces in artifact names,
   * as they can unpredictably change during deployment, making them impossible to locate and download for update.
   */
  // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder placeholder template
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  asarUnpack: ['**/node_modules/@node-usb/**/*'],
  files: [
    'LICENSE*',
    '!node_modules/@app/**',
    ...getListOfFilesFromEachWorkspace(['main', 'preload', 'renderer']),
    ...getNativePrebuildFiles(),
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
 * 扫描 pnpm 虚拟存储并收集所有原生预编译包（如 @node-usb），映射到最终 node_modules/@node-usb
 */
function getNativePrebuildFiles(): Array<{ from: string; to: string; filter: string[] }> {
  const pnpmDir = join(process.cwd(), 'node_modules', '.pnpm');
  const files: Array<{ from: string; to: string; filter: string[] }> = [];
  if (!fs.existsSync(pnpmDir)) return files;

  const entries = fs.readdirSync(pnpmDir);
  for (const entry of entries) {
    if (entry.startsWith('@node-usb+')) {
      const pkgParent = join(pnpmDir, entry, 'node_modules', '@node-usb');
      if (fs.existsSync(pkgParent)) {
        for (const sub of fs.readdirSync(pkgParent)) {
          const relativeFrom = join(
            'node_modules',
            '.pnpm',
            entry,
            'node_modules',
            '@node-usb',
            sub,
          ).replace(/\\/g, '/');
          files.push({
            from: relativeFrom,
            to: `node_modules/@node-usb/${sub}`,
            filter: ['package.json', '*.node', '!**/*.map'],
          });
        }
      }
    }
  }
  return files;
}

/**
 * 显式读取指定 workspace 子包的 package.json 中的 files 配置，生成打包匹配规则
 */
function getListOfFilesFromEachWorkspace(
  workspaces: string[],
): Array<{ from: string; to: string; filter: string[] }> {
  const packagesDir = join(process.cwd(), 'packages');
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
