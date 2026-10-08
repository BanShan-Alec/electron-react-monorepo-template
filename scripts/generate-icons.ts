import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import pngToIcoModule from 'png-to-ico';
import png2icons from 'png2icons';

const pngToIco: (images: Buffer[]) => Promise<Buffer> =
  (pngToIcoModule as unknown as { default: (images: Buffer[]) => Promise<Buffer> }).default ||
  (pngToIcoModule as unknown as (images: Buffer[]) => Promise<Buffer>);

const ROOT = process.cwd();
const RESOURCES_DIR = path.join(ROOT, 'build', 'resources');
const APP_SVG_PATH = path.join(ROOT, 'packages', 'renderer', 'src', 'assets', 'startup-logo.svg');
const INSTALLER_SVG_PATH = path.join(
  ROOT,
  'packages',
  'renderer',
  'src',
  'assets',
  'installer-logo.svg',
);

const ICO_SIZES = [256, 128, 64, 48, 32, 16];

function renderSvgToPng(svgContent: string, width: number): Buffer {
  const resvg = new Resvg(svgContent, {
    fitTo: { mode: 'width', value: width },
  });
  return resvg.render().asPng();
}

async function run() {
  console.log('🎨 Generating multi-platform icons from SVGs...');
  if (!fs.existsSync(RESOURCES_DIR)) {
    fs.mkdirSync(RESOURCES_DIR, { recursive: true });
  }

  // 1. 生成应用运行图标 (icon.png, icon.ico, icon.icns)
  console.log('⚡ Processing application runtime logo (startup-logo.svg)...');
  const appSvg = fs.readFileSync(APP_SVG_PATH, 'utf8');

  // Linux / universal 512x512
  const appPng512 = renderSvgToPng(appSvg, 512);
  const appPngPath = path.join(RESOURCES_DIR, 'icon.png');
  fs.writeFileSync(appPngPath, appPng512);
  console.log(`  -> Wrote ${appPngPath} (512x512 PNG)`);

  // Windows icon.ico (多分辨率)
  const appPngSizes = ICO_SIZES.map((size) => renderSvgToPng(appSvg, size));
  const appIcoBuf = await pngToIco(appPngSizes);
  const appIcoPath = path.join(RESOURCES_DIR, 'icon.ico');
  fs.writeFileSync(appIcoPath, appIcoBuf);
  console.log(`  -> Wrote ${appIcoPath} (multi-layer ICO)`);

  // macOS icon.icns (基于 1024x1024 高清图转换)
  const appPng1024 = renderSvgToPng(appSvg, 1024);
  const icnsBuf = png2icons.createICNS(appPng1024, png2icons.BILINEAR, 0);
  if (icnsBuf) {
    const appIcnsPath = path.join(RESOURCES_DIR, 'icon.icns');
    fs.writeFileSync(appIcnsPath, icnsBuf);
    console.log(`  -> Wrote ${appIcnsPath} (macOS ICNS)`);
  } else {
    console.warn('  ⚠️ Failed to generate ICNS buffer');
  }

  // 2. 生成安装包图标 (installer.ico, installer.png)
  console.log('📦 Processing installer logo (installer-logo.svg)...');
  const installerSvg = fs.readFileSync(INSTALLER_SVG_PATH, 'utf8');

  const installerPng512 = renderSvgToPng(installerSvg, 512);
  const installerPngPath = path.join(RESOURCES_DIR, 'installer.png');
  fs.writeFileSync(installerPngPath, installerPng512);
  console.log(`  -> Wrote ${installerPngPath} (512x512 PNG)`);

  const installerPngSizes = ICO_SIZES.map((size) => renderSvgToPng(installerSvg, size));
  const installerIcoBuf = await pngToIco(installerPngSizes);
  const installerIcoPath = path.join(RESOURCES_DIR, 'installer.ico');
  fs.writeFileSync(installerIcoPath, installerIcoBuf);
  console.log(`  -> Wrote ${installerIcoPath} (NSIS installer ICO)`);

  console.log('✅ All icons successfully generated and refreshed!');
}

run().catch((err) => {
  console.error('❌ Icon generation failed:', err);
  process.exit(1);
});
