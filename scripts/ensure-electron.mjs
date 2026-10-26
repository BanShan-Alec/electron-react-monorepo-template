// electron 42+ 起 npm 包不再带 install 生命周期脚本，二进制改为惰性下载：
// 仅当 dist 部分存在（path.txt 在）时首次运行会自愈；全新安装（无 dist）直接抛
// "Electron failed to install correctly"，新 worktree 必踩。
// 本守卫在每次安装后兜底：dist 缺失/版本不符时执行 install.js（命中机器级 zip 缓存约 2 秒）。
// CI 中由 e2e job 显式执行 install-electron，此处跳过，避免无关 job 重复下载。

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

if (process.env.CI) process.exit(0);

const pkgPath = 'node_modules/electron/package.json';
if (!existsSync(pkgPath)) process.exit(0);

const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));

// 判定逻辑对齐 electron install.js 的 isInstalled()：版本一致 + path.txt 在 + 其指向的二进制存在
function distReady() {
  const versionFile = 'node_modules/electron/dist/version';
  if (!existsSync(versionFile)) return false;
  if (readFileSync(versionFile, 'utf8').trim() !== version) return false;
  const pathTxt = 'node_modules/electron/dist/path.txt';
  if (!existsSync(pathTxt)) return false;
  const executable = readFileSync(pathTxt, 'utf8').trim();
  return existsSync(`node_modules/electron/dist/${executable}`);
}

if (distReady()) process.exit(0);

try {
  execSync('node node_modules/electron/install.js', { stdio: 'inherit' });
} catch (err) {
  console.warn(
    '[ensure-electron] 二进制补装失败（不影响安装本身）；启动前请手动执行 pnpm exec install-electron：',
    err.message,
  );
}
