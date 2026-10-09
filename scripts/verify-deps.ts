import fs from 'node:fs';
import { isBuiltin } from 'node:module';
import { join } from 'node:path';

interface VerificationResult {
  valid: boolean;
  errors: string[];
}

export async function verifyDependencies(): Promise<VerificationResult> {
  const rootDir = process.cwd();
  const errors: string[] = [];

  console.log('🔍 [verify-deps] 开始校验 Monorepo 依赖拓扑与主进程 external 对应关系...');

  // 1. 根目录 package.json dependencies 边界校验（防退化门禁）
  const rootPkgPath = join(rootDir, 'package.json');
  if (!fs.existsSync(rootPkgPath)) {
    throw new Error(`找不到根目录 package.json: ${rootPkgPath}`);
  }

  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  const rootDeps = Object.keys(rootPkg.dependencies || {});
  const allowedRootDeps = ['@app/main'];

  const illegalRootDeps = rootDeps.filter((dep) => !allowedRootDeps.includes(dep));
  if (illegalRootDeps.length > 0) {
    errors.push(
      `[根目录依赖违规] 根 package.json 的 dependencies 中检测到非法依赖: ${JSON.stringify(illegalRootDeps)}。\n` +
        `  -> 规范要求: 根目录 dependencies 严格仅允许 ['@app/main']，` +
        `任何其他子包（如 @app/renderer, @app/preload）或第三方依赖必须置于 devDependencies，` +
        `以防止 electron-builder 扫描依赖树时将非主进程模块卷入 app.asar 导致体积膨胀。`,
    );
  } else {
    console.log('  ✅ 根目录 dependencies 校验通过 (严格仅限 @app/main)');
  }

  // 2. 主进程 dependencies 与 packages/main/vite.config.ts external 双向对齐校验
  const mainPkgPath = join(rootDir, 'packages', 'main', 'package.json');
  if (!fs.existsSync(mainPkgPath)) {
    throw new Error(`找不到主进程 package.json: ${mainPkgPath}`);
  }

  const mainPkg = JSON.parse(fs.readFileSync(mainPkgPath, 'utf8'));
  // 过滤掉以 @app/ 开头的 workspace 子包
  const mainRuntimeDeps = Object.keys(mainPkg.dependencies || {}).filter(
    (dep) => !dep.startsWith('@app/'),
  );

  // 解析 packages/main/vite.config.ts 中的 external
  let externalList: string[] = [];
  try {
    const viteConfigModule = await import('../packages/main/vite.config.ts');
    const viteConfig = viteConfigModule.default || viteConfigModule;
    const rolldownExternal =
      viteConfig?.build?.rolldownOptions?.external ||
      viteConfig?.build?.rollupOptions?.external ||
      [];

    const rawExternal = Array.isArray(rolldownExternal) ? rolldownExternal : [rolldownExternal];
    externalList = rawExternal.filter((item): item is string => typeof item === 'string');
  } catch (err) {
    console.warn('  ⚠️ 动态导入 packages/main/vite.config.ts 失败，降级为静态正则解析', err);
    const viteConfigText = fs.readFileSync(join(rootDir, 'packages/main/vite.config.ts'), 'utf8');
    const match = viteConfigText.match(/external:\s*\[([\s\S]*?)\]/);
    if (match) {
      externalList = match[1]
        .split(',')
        .map((s) => s.trim().replace(/['"]/g, ''))
        .filter(Boolean);
    }
  }

  // 过滤掉 electron 与 Node.js 内置模块
  const mainExternalDeps = externalList.filter(
    (dep) =>
      dep !== 'electron' && !isBuiltin(dep) && !dep.startsWith('node:') && !dep.startsWith('/'),
  );

  // 校验 A: 声明在 main dependencies 中的库必须在 external 中
  const missingInExternal = mainRuntimeDeps.filter((dep) => !mainExternalDeps.includes(dep));
  if (missingInExternal.length > 0) {
    errors.push(
      `[打包外置遗漏] 以下主进程生产依赖未在 packages/main/vite.config.ts 的 external 中配置: ${JSON.stringify(missingInExternal)}。\n` +
        `  -> 影响: 运行时库未被外置，可能会被 Vite 重复内联打包导致产物膨胀或不可预期行为。`,
    );
  }

  // 校验 B: 在 external 中排除的第三方库必须在 main dependencies 中声明
  const missingInDependencies = mainExternalDeps.filter((dep) => !mainRuntimeDeps.includes(dep));
  if (missingInDependencies.length > 0) {
    errors.push(
      `[运行时依赖缺失] 以下模块在 packages/main/vite.config.ts 的 external 中被排除，但未在 packages/main/package.json 的 dependencies 中声明: ${JSON.stringify(missingInDependencies)}。\n` +
        `  -> 致命风险: 打包后主进程在生产运行时执行 require('${missingInDependencies[0]}') 将抛出 MODULE_NOT_FOUND 导致程序直接白屏崩溃！`,
    );
  }

  if (missingInExternal.length === 0 && missingInDependencies.length === 0) {
    console.log(
      `  ✅ 主进程 dependencies 与 Vite external 双向完全对齐: [${mainRuntimeDeps.join(', ')}]`,
    );
  }

  const valid = errors.length === 0;
  if (!valid) {
    console.error('\n❌ [verify-deps] 依赖拓扑规范校验失败:');
    for (const error of errors) {
      console.error(`\n• ${error}`);
    }
  } else {
    console.log('🎉 [verify-deps] 依赖规范与打包配置一致性校验全部通过！\n');
  }

  return { valid, errors };
}

// CLI 直启入口
if (process.argv[1]?.endsWith('verify-deps.ts')) {
  verifyDependencies()
    .then(({ valid }) => {
      if (!valid) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('❌ [verify-deps] 执行异常:', err);
      process.exit(1);
    });
}
