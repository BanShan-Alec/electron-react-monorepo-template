import fs from 'node:fs';
import { join } from 'node:path';
import type { Configuration } from 'electron-builder';

const config: Configuration = {
  directories: {
    output: 'dist',
    buildResources: 'build/resources',
  },
  generateUpdatesFilesForAllChannels: true,
  publish: {
    provider: 'github',
    owner: 'BanShan-Alec',
    repo: 'electron-react-monorepo-template',
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
    shortcutName: 'Electron React Template',
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
