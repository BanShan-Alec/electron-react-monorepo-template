import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { build, type CliOptions } from 'electron-builder';

/**
 * CLI Argument Parsing
 */
const { values } = parseArgs({
  options: {
    dir: { type: 'boolean', default: false },
    win: { type: 'boolean', default: false },
    mac: { type: 'boolean', default: false },
    linux: { type: 'boolean', default: false },
    x64: { type: 'boolean' },
    arm64: { type: 'boolean' },
    publish: { type: 'string', short: 'p' },
    config: { type: 'string', short: 'c', default: 'build/electron-builder.ts' },
    'skip-build': { type: 'boolean', default: false },
  },
  strict: false,
  allowPositionals: true,
});

async function runBuild() {
  // 1. Build workspace packages first unless --skip-build is specified
  if (!values['skip-build']) {
    console.log('📦 Building workspace packages...');
    execSync('pnpm -r run build', { stdio: 'inherit' });
  }

  // 2. Assemble electron-builder packaging options
  const buildOptions: CliOptions = {
    config: typeof values.config === 'string' ? values.config : 'build/electron-builder.ts',
    dir: Boolean(values.dir),
  };

  if (values.win) buildOptions.win = [];
  if (values.mac) buildOptions.mac = [];
  if (values.linux) buildOptions.linux = [];
  if (values.x64) buildOptions.x64 = true;
  if (values.arm64) buildOptions.arm64 = true;
  if (typeof values.publish === 'string') {
    buildOptions.publish = values.publish as CliOptions['publish'];
  }

  // 3. Trigger packaging
  console.log('🚀 Packaging Electron application with electron-builder...');
  try {
    await build(buildOptions);
    console.log('✅ Packaging completed successfully!');
  } catch (error) {
    console.error('❌ Packaging failed:', error);
    process.exit(1);
  }
}

runBuild();
