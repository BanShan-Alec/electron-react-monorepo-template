import fs from 'node:fs';
import { join } from 'node:path';
import type { Configuration } from 'electron-builder';

const pkg = JSON.parse(fs.readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

const config: Configuration = {
  directories: {
    output: 'dist',
    buildResources: 'build/resources',
  },
  generateUpdatesFilesForAllChannels: true,
  linux: {
    target: ['deb'],
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
    pkg.main,
    '!node_modules/@app/**',
    ...getListOfFilesFromEachWorkspace(),
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
 * Scan workspace packages and selectively include files based on each package's "files" configuration
 */
function getListOfFilesFromEachWorkspace(): string[] {
  const packagesDir = join(process.cwd(), 'packages');
  if (!fs.existsSync(packagesDir)) {
    return [];
  }

  const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
  const allFilesToInclude: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pkgPath = join(packagesDir, entry.name, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;

    const workspacePkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    const name = workspacePkg.name;
    if (!name) continue;

    // @app/main 的入口产物已由 pkg.main (packages/main/dist/index.cjs) 单独纳入，
    // 无需在 node_modules/@app/main 重复打包同一份产物，避免 asar 内产物冗余双份
    if (name === '@app/main') continue;

    let patterns = workspacePkg.files || ['dist/**', 'package.json'];
    patterns = patterns.map((p: string) => join('node_modules', name, p).replace(/\\/g, '/'));
    allFilesToInclude.push(...patterns);
  }

  return allFilesToInclude;
}
