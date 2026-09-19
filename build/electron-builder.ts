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
    maintainer: 'BanShan-Alec <627649674@qq.com>',
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
  files: ['LICENSE*', pkg.main, '!node_modules/@app/**', ...getListOfFilesFromEachWorkspace()],
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

    let patterns = workspacePkg.files || ['dist/**', 'package.json'];
    patterns = patterns.map((p: string) => join('node_modules', name, p).replace(/\\/g, '/'));
    allFilesToInclude.push(...patterns);
  }

  return allFilesToInclude;
}
