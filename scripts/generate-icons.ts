import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

/**
 * 将多尺寸 PNG 图像数据打包为符合 Microsoft 规范的现代 .ico 文件 (含 32 位 PNG 压缩)
 */
function createIco(images: Array<{ width: number; height: number; buffer: Buffer }>): Buffer {
  const count = images.length;
  const headerSize = 6 + count * 16;
  let currentOffset = headerSize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(count, 4); // count

  const imageBuffers: Buffer[] = [];

  for (let i = 0; i < count; i++) {
    const { width, height, buffer } = images[i];
    const entryOffset = 6 + i * 16;
    header.writeUInt8(width >= 256 ? 0 : width, entryOffset); // bWidth (0 = 256)
    header.writeUInt8(height >= 256 ? 0 : height, entryOffset + 1); // bHeight (0 = 256)
    header.writeUInt8(0, entryOffset + 2); // bColorCount
    header.writeUInt8(0, entryOffset + 3); // bReserved
    header.writeUInt16LE(1, entryOffset + 4); // wPlanes
    header.writeUInt16LE(32, entryOffset + 6); // wBitCount
    header.writeUInt32LE(buffer.length, entryOffset + 8); // dwBytesInRes
    header.writeUInt32LE(currentOffset, entryOffset + 12); // dwImageOffset

    currentOffset += buffer.length;
    imageBuffers.push(buffer);
  }

  return Buffer.concat([header, ...imageBuffers]);
}

/**
 * 寻找本地可用的 Chromium 或 Edge 内核
 */
function findBrowserExecutable(): string | undefined {
  const possiblePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return undefined;
}

/**
 * 寻找 app-builder 二进制可执行文件
 */
function findAppBuilderExecutable(): string | undefined {
  const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm');
  if (!fs.existsSync(pnpmDir)) return undefined;

  const binDir = fs.readdirSync(pnpmDir).find((d) => d.startsWith('app-builder-bin@'));
  if (!binDir) return undefined;

  const appBuilderExe = path.join(
    pnpmDir,
    binDir,
    'node_modules',
    'app-builder-bin',
    'win',
    'x64',
    'app-builder.exe',
  );
  return fs.existsSync(appBuilderExe) ? appBuilderExe : undefined;
}

async function generateIcons() {
  console.log('🎨 开始从矢量源 startup-logo.svg 生成高清晰度应用图标资产...');

  const executablePath = findBrowserExecutable();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });

  const svgPath = path.join(process.cwd(), 'packages/renderer/src/assets/startup-logo.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  const resourcesDir = path.join(process.cwd(), 'build/resources');
  fs.mkdirSync(resourcesDir, { recursive: true });

  // 1. 生成各标准尺寸的像素级对齐高质量 PNG
  const icoSizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
  const icoImages: Array<{ width: number; height: number; buffer: Buffer }> = [];

  for (const size of icoSizes) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { width: ${size}px; height: ${size}px; background: transparent; overflow: hidden; }
            svg { width: ${size}px; height: ${size}px; display: block; }
          </style>
        </head>
        <body>${svgContent}</body>
      </html>
    `);

    const pngBuffer = await page.screenshot({ omitBackground: true });
    icoImages.push({ width: size, height: size, buffer: pngBuffer });
    await page.close();
  }

  // 2. 生成 512x512 高清应用 PNG
  const page512 = await browser.newPage({
    viewport: { width: 512, height: 512 },
    deviceScaleFactor: 1,
  });
  await page512.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 512px; height: 512px; background: transparent; overflow: hidden; }
          svg { width: 512px; height: 512px; display: block; }
        </style>
      </head>
      <body>${svgContent}</body>
    </html>
  `);
  const png512Buffer = await page512.screenshot({ omitBackground: true });
  const iconPngPath = path.join(resourcesDir, 'icon.png');
  fs.writeFileSync(iconPngPath, png512Buffer);
  console.log(`✅ 已生成高质量 icon.png (512x512): ${iconPngPath}`);
  await page512.close();

  await browser.close();

  // 4. 打包 Windows 多分辨率抗锯齿 .ico 文件
  const icoBuffer = createIco(icoImages);
  const iconIcoPath = path.join(resourcesDir, 'icon.ico');
  fs.writeFileSync(iconIcoPath, icoBuffer);
  console.log(
    `✅ 已生成 Windows 高清多分辨率抗锯齿 icon.ico (含 16, 20, 24, 32, 40, 48, 64, 128, 256 阶梯): ${iconIcoPath}`,
  );

  // 5. 调用 app-builder 生成 macOS .icns 文件
  const appBuilderExe = findAppBuilderExecutable();
  if (appBuilderExe) {
    try {
      const tempIcnsOut = path.join(process.cwd(), 'dist', '.temp-icns');
      fs.mkdirSync(tempIcnsOut, { recursive: true });
      execSync(
        `"${appBuilderExe}" icon --format icns --root "${resourcesDir}" --input icon.png --out "${tempIcnsOut}"`,
        { stdio: 'pipe' },
      );
      const generatedIcns = path.join(tempIcnsOut, 'icon.icns');
      if (fs.existsSync(generatedIcns)) {
        fs.copyFileSync(generatedIcns, path.join(resourcesDir, 'icon.icns'));
        console.log(`✅ 已通过 app-builder 生成 macOS icon.icns`);
      }
      fs.rmSync(tempIcnsOut, { recursive: true, force: true });
    } catch (icnsErr) {
      console.warn('⚠️ 生成 icon.icns 失败，跳过:', icnsErr);
    }
  }

  console.log('🎉 图标资产重新构建完成！');
}

generateIcons().catch((err) => {
  console.error('❌ 图标生成失败:', err);
  process.exit(1);
});
