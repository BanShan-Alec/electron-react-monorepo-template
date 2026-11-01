import { type ChildProcess, execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';
import electronPath from 'electron';
import { build, createServer, type Plugin, type ViteDevServer } from 'vite';
import { applyRepoEnv, loadRepoEnv } from '../build/lib/env.ts';
import { ensureNoAppInstanceRunning } from './instance-guard.ts';
import { ensurePortsAvailable, killProcessTree } from './port-guard.ts';

// 统一从 build/lib/env.ts 加载根 .env（外部注入优先），并向上锁定仓库根
const repoEnv = loadRepoEnv(__dirname);
applyRepoEnv(repoEnv);
const ROOT_DIR = repoEnv.rootDir;

// MODE 由 package.json 脚本经 cross-env 注入(dev=development / preview=production)。
// 未注入时归一为 production:主进程的 isDev / isProd 与窗口加载路径统一按生产语义,
// 不再出现「开发语义 + 加载 dist」的混合态。
if (!process.env.MODE) {
  console.warn('[dev] MODE 未注入(应经 package.json 脚本的 cross-env 提供),已归一为 production');
  process.env.MODE = 'production';
}

// 与主进程 devServerUrl 的判定同源（见 packages/main/src/env.ts）：
// 只有 MODE=development 才会消费 renderer dev server，其余形态一律加载 dist 产物
const isDevSession = process.env.MODE === 'development';
const LOG_PREFIX = isDevSession ? '[dev]' : '[preview]';

// Windows 平台下将控制台代码页切换为 UTF-8 (65001)，解决 Git Bash 等终端日志中文乱码问题
if (process.platform === 'win32') {
  try {
    execSync('chcp 65001', { stdio: 'ignore' });
  } catch {
    // 忽略异常，降级保持原有行为
  }
}

/**
 * 默认配置。
 * mainInspectPort / rendererCdpPort 为「可注释开关」:注释掉对应属性即可关闭该功能,
 * 相关命令行参数与启动日志会一起被跳过(注释后该属性为 undefined,被 if 安全跳过)。
 */
const config: {
  mode: string;
  rendererPort: number;
  mainInspectPort?: number;
  rendererCdpPort?: number;
} = {
  mode: process.env.MODE ?? 'production',
  rendererPort: 5173,

  // 按需注释:注释掉即关闭对应能力
  // mainInspectPort: 9229, // 主进程调试断点端口(--inspect-brk)
  rendererCdpPort: 9222, // 渲染进程 CDP 端口(--remote-debugging-port)
};

/** 组装 Electron 启动参数;对应端口被注释掉时自动跳过并关闭日志。 */
function buildElectronArgs(): string[] {
  const args: string[] = [];

  if (config.mainInspectPort) {
    args.push(`--inspect-brk=${config.mainInspectPort}`);
    console.log(
      `${LOG_PREFIX} main break inspect endpoint: http://127.0.0.1:${config.mainInspectPort}`,
    );
  }

  if (config.rendererCdpPort) {
    args.push(`--remote-debugging-port=${config.rendererCdpPort}`);
    console.log(`${LOG_PREFIX} renderer CDP endpoint: http://127.0.0.1:${config.rendererCdpPort}`);
  }

  return args;
}

/** preload 重载插件:preload 重新构建后通知渲染进程全量刷新。 */
function createPreloadReloaderPlugin(server: ViteDevServer): Plugin {
  return {
    name: '[dev]preload-dev-reloader',
    writeBundle() {
      server.ws.send({
        type: 'full-reload',
      });
    },
  };
}

/** 终端退出信号:连带强杀 Electron 子进程树,防止僵尸进程退到后台托盘。 */
function attachExitCleanup(getPid: () => number | undefined): void {
  const handleExitSignal = async () => {
    const pid = getPid();
    if (pid) {
      await killProcessTree(pid);
    }
    process.exit(0);
  };
  process.once('SIGINT', handleExitSignal);
  process.once('SIGTERM', handleExitSignal);
}

/** Electron 启动插件:主进程重新构建后重启 Electron;内部自持进程句柄。 */
function createElectronLauncherPlugin(): Plugin {
  let electronApp: ChildProcess | null = null;

  attachExitCleanup(() => electronApp?.pid);

  return {
    name: '[dev]main-electron-launcher',
    async writeBundle() {
      /** Kill electron if a process already exists */
      if (electronApp !== null) {
        electronApp.removeListener('exit', process.exit);
        if (electronApp.pid) {
          await killProcessTree(electronApp.pid);
        } else {
          electronApp.kill('SIGINT');
        }
        electronApp = null;
      }

      /** Spawn a new electron process */
      const args = buildElectronArgs();

      // --remote-debugging-port 暴露 renderer CDP，供外部 CDP 客户端连接驱动
      electronApp = spawn(String(electronPath), [...args, '.'], { stdio: 'inherit' });

      /** Stops the watch script when the application has been quit */
      electronApp?.addListener('exit', process.exit);
    },
  };
}

/** 创建并启动渲染进程 dev server，并向 process.env 注入 VITE_DEV_SERVER_URL。 */
async function startRendererDevServer(): Promise<ViteDevServer> {
  const server = await createServer({
    mode: config.mode,
    server: {
      port: config.rendererPort,
    },
    root: path.join(ROOT_DIR, 'packages', 'renderer'),
    configLoader: 'bundle',
  });

  await server.listen();

  // 透传给主进程，设置渲染进程 dev-server 的 URL
  if (server.resolvedUrls?.local?.[0]) {
    process.env.VITE_DEV_SERVER_URL = server.resolvedUrls.local[0];
  }

  return server;
}

/** 开发入口:编排渲染进程服务器与两个 watch 构建,副作用只发生在此。 */
async function startDevServer(): Promise<void> {
  console.log(`${LOG_PREFIX} mode=development: Vite dev server + preload/main watch`);

  // 0. 单实例排查：打包版托盘常驻 / 旧 dev 实例持有单实例锁会让新实例直接退出，
  //    交互确认后终止；置于端口排查之前，dev-vs-dev 场景下对端 electron 被杀会连带
  //    其 dev 会话自行退出并释放端口，一次确认解决两件事
  await ensureNoAppInstanceRunning(ROOT_DIR);

  // 1. 启动前端口排查与定向释放
  await ensurePortsAvailable([
    { port: config.rendererPort, desc: 'Vite Renderer' },
    { port: config.rendererCdpPort, desc: 'Renderer CDP Debugging' },
    { port: config.mainInspectPort, desc: 'Main Inspect Break' },
  ]);

  // 2. Create and start Vite dev server for the renderer
  const rendererWatchServer = await startRendererDevServer();

  // 3. Build independent plugins from factories
  const preloadReloaderPlugin = createPreloadReloaderPlugin(rendererWatchServer);
  const electronLauncherPlugin = createElectronLauncherPlugin();

  // 4. Watch and build packages with their respective plugins
  await build({
    mode: config.mode,
    root: path.join(ROOT_DIR, 'packages', 'preload'),
    plugins: [preloadReloaderPlugin],
    build: {
      watch: {},
    },
  });
  await build({
    mode: config.mode,
    root: path.join(ROOT_DIR, 'packages', 'main'),
    plugins: [electronLauncherPlugin],
    build: {
      watch: {},
    },
  });
}

/** preview 专属参数:`pnpm preview -- --skip-build` 跳过构建,直接启动现有产物。 */
function parsePreviewArgs(): { skipBuild: boolean } {
  // pnpm 会把 `--` 分隔符原样带进 argv,parseArgs 视其为 positional 起点、
  // 之后的选项全部失效,所以先剔除
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const { values } = parseArgs({
    args,
    options: {
      'skip-build': { type: 'boolean', default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  return { skipBuild: Boolean(values['skip-build']) };
}

/**
 * 生产预览入口:一次性构建 → 启动 Electron → 应用退出即命令退出。
 * 不起 renderer dev server,也不做端口预检——窗口加载的是 dist 产物,没有服务需要占用端口。
 */
async function runPreview(): Promise<void> {
  const { skipBuild } = parsePreviewArgs();

  // 旧实例持有单实例锁会让新进程直接退出,窗口不出现也没有解释
  await ensureNoAppInstanceRunning(ROOT_DIR);

  if (!skipBuild) {
    console.log(`${LOG_PREFIX} 📦 Building workspace packages (main / preload / renderer)...`);
    // 只构建应用运行所需的三包:pnpm build 会连带构建 @app/docs,预览用不到
    execSync('pnpm -r --filter @app/main --filter @app/preload --filter @app/renderer run build', {
      stdio: 'inherit',
    });
  } else {
    console.warn(`${LOG_PREFIX} --skip-build:未校验产物完整性,缺失时应用可能无窗口常驻`);
  }

  console.log(`${LOG_PREFIX} mode=${config.mode}: 跳过 renderer dev server,加载 dist 产物`);

  const electronApp = spawn(String(electronPath), [...buildElectronArgs(), '.'], {
    stdio: 'inherit',
  });

  attachExitCleanup(() => electronApp.pid);

  // 用户正常退出应用时,preview 命令跟着结束
  electronApp.on('exit', (code) => process.exit(code ?? 0));
}

async function main(): Promise<void> {
  if (isDevSession) {
    await startDevServer();
  } else {
    await runPreview();
  }
}

main().catch((err) => {
  console.error(`${LOG_PREFIX} 启动失败:`, err);
  process.exit(1);
});
