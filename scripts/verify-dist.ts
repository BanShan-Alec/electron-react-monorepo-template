const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('@playwright/test');

interface DistVerificationOptions {
  /**
   * asar 体积阈值（MB），超过则判定为防劣化门禁失败
   * 默认 10MB（可通过环境变量 MAX_ASAR_SIZE_MB 覆盖）
   */
  maxAsarSizeMb?: number;
  /**
   * 自定义 dist 目录路径（默认根目录 dist）
   */
  distDir?: string;
}

interface DetectedArtifact {
  executablePath: string;
  asarPath: string;
  platform: 'win32' | 'darwin' | 'linux';
}

/**
 * 自动跨平台发现 dist 下解包出来的目标二进制与 app.asar
 */
function detectUnpackedArtifact(distDir: string): DetectedArtifact | null {
  if (!fs.existsSync(distDir)) {
    return null;
  }

  // 1. Windows 检测 (dist/win-unpacked/)
  const winUnpackedDir = path.join(distDir, 'win-unpacked');
  if (fs.existsSync(winUnpackedDir)) {
    const files = fs.readdirSync(winUnpackedDir);
    const exeName = files.find(
      (f: string) => f.endsWith('.exe') && !f.toLowerCase().includes('uninstall'),
    );
    const asarPath = path.join(winUnpackedDir, 'resources', 'app.asar');
    if (exeName && fs.existsSync(asarPath)) {
      return {
        executablePath: path.join(winUnpackedDir, exeName),
        asarPath,
        platform: 'win32',
      };
    }
  }

  // 2. macOS 检测 (dist/mac/ 或 dist/mac-arm64/)
  for (const macDirName of ['mac', 'mac-arm64']) {
    const macDir = path.join(distDir, macDirName);
    if (fs.existsSync(macDir)) {
      const appFolder = fs.readdirSync(macDir).find((f: string) => f.endsWith('.app'));
      if (appFolder) {
        const macOSDir = path.join(macDir, appFolder, 'Contents', 'MacOS');
        const asarPath = path.join(macDir, appFolder, 'Contents', 'Resources', 'app.asar');
        if (fs.existsSync(macOSDir) && fs.existsSync(asarPath)) {
          const binaryName = fs.readdirSync(macOSDir)[0];
          if (binaryName) {
            return {
              executablePath: path.join(macOSDir, binaryName),
              asarPath,
              platform: 'darwin',
            };
          }
        }
      }
    }
  }

  // 3. Linux 检测 (dist/linux-unpacked/)
  const linuxUnpackedDir = path.join(distDir, 'linux-unpacked');
  if (fs.existsSync(linuxUnpackedDir)) {
    const asarPath = path.join(linuxUnpackedDir, 'resources', 'app.asar');
    if (fs.existsSync(asarPath)) {
      const files = fs.readdirSync(linuxUnpackedDir);
      const ignoredBinaries = new Set(['chrome-sandbox', 'chrome_crashpad_handler']);
      const binaryName = files.find((f: string) => {
        if (ignoredBinaries.has(f)) return false;
        const fullPath = path.join(linuxUnpackedDir, f);
        try {
          const stat = fs.statSync(fullPath);
          return stat.isFile() && !f.includes('.') && Boolean(stat.mode & 0o111);
        } catch {
          return false;
        }
      });
      if (binaryName) {
        return {
          executablePath: path.join(linuxUnpackedDir, binaryName),
          asarPath,
          platform: 'linux',
        };
      }
    }
  }

  return null;
}

/**
 * 校验已打包产物完整性与可用性
 */
async function verifyDist(options: DistVerificationOptions = {}): Promise<void> {
  const distDir = path.resolve(options.distDir || 'dist');
  const maxAsarSizeMb = options.maxAsarSizeMb ?? Number(process.env.MAX_ASAR_SIZE_MB || 10);

  console.log('\n🔍 [verify-dist] 开始打包产物 Smoke 自动化验证...');

  const artifact = detectUnpackedArtifact(distDir);
  if (!artifact) {
    throw new Error(
      `[verify-dist] 未在 ${distDir} 找到解包产物（支持 win-unpacked / mac / linux-unpacked）。请先完成打包构建。`,
    );
  }

  console.log(`📦 [verify-dist] 发现解包产物: ${artifact.executablePath}`);
  console.log(`📄 [verify-dist] 发现 asar 归档: ${artifact.asarPath}`);

  // 1. asar 体积门禁校验
  const asarStat = fs.statSync(artifact.asarPath);
  const asarSizeMb = asarStat.size / (1024 * 1024);
  console.log(
    `📊 [verify-dist] asar 体积: ${asarSizeMb.toFixed(2)} MB (${asarStat.size.toLocaleString()} bytes) [阈值上限: ${maxAsarSizeMb.toFixed(2)} MB]`,
  );

  if (asarSizeMb > maxAsarSizeMb) {
    throw new Error(
      `❌ [verify-dist] asar 体积超过门禁上限 (${asarSizeMb.toFixed(2)} MB > ${maxAsarSizeMb.toFixed(2)} MB)，发生体积异常膨胀防劣化失败！`,
    );
  }
  console.log('✅ [verify-dist] asar 体积门禁检查通过！');

  // 2. 跨平台宿主兼任性守卫：若当前环境无法直接拉起目标二进制（例如 Linux 交叉编译构建了 Windows exe），安全跳过运行时测试
  if (process.platform !== artifact.platform) {
    console.warn(
      `⚠️ [verify-dist] 目标平台 (${artifact.platform}) 与当前宿主平台 (${process.platform}) 不一致，跳过真实进程启动测试。`,
    );
    return;
  }

  // 3. 真实启动打包二进制进行 Smoke 校验
  console.log('🚀 [verify-dist] 启动已打包程序执行运行时健康检查...');
  const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-smoke-test-'));

  try {
    const app = await electron.launch({
      executablePath: artifact.executablePath,
      args: [
        `--user-data-dir=${tempUserDataDir}`,
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
      ],
      timeout: 30000,
    });

    try {
      console.log('⏳ [verify-dist] 等待主窗口就绪...');
      const page = await app.firstWindow();
      const title = await page.title();
      console.log(`🪟 [verify-dist] 主窗口捕获成功: title="${title}"`);

      console.log('⏳ [verify-dist] 校验 #root 界面渲染...');
      await page.waitForSelector('#root', { timeout: 15000 });
      console.log('✅ [verify-dist] React 渲染容器 #root 已成功挂载！');
    } finally {
      await app.close();
      console.log('🛑 [verify-dist] 应用程序已正常优雅退出。');
    }
  } finally {
    try {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true });
    } catch {
      // 忽略临时目录清理异常
    }
  }

  console.log('🎉 [verify-dist] 打包产物直接运行验证全部通过！\n');
}

module.exports = { detectUnpackedArtifact, verifyDist };

// 支持直接作为 CLI 执行
if (require.main === module) {
  verifyDist().catch((err) => {
    console.error('❌ [verify-dist] 校验失败:', err);
    process.exit(1);
  });
}
