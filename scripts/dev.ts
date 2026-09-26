import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import electronPath from 'electron';
import { build, createServer, type Plugin, type ViteDevServer } from 'vite';

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
  mode: 'development',
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
    console.log(`[dev] main break inspect endpoint: http://127.0.0.1:${config.mainInspectPort}`);
  }

  if (config.rendererCdpPort) {
    args.push(`--remote-debugging-port=${config.rendererCdpPort}`);
    console.log(`[dev] renderer CDP endpoint: http://127.0.0.1:${config.rendererCdpPort}`);
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

/** Electron 启动插件:主进程重新构建后重启 Electron;内部自持进程句柄。 */
function createElectronLauncherPlugin(): Plugin {
  let electronApp: ChildProcess | null = null;

  return {
    name: '[dev]main-electron-launcher',
    writeBundle() {
      /** Kill electron if a process already exists */
      if (electronApp !== null) {
        electronApp.removeListener('exit', process.exit);
        electronApp.kill('SIGINT');
        electronApp = null;
      }

      /** Spawn a new electron process */
      const args = buildElectronArgs();

      // --remote-debugging-port 暴露 renderer CDP，供外部 CDP 客户端连接驱动
      electronApp = spawn(String(electronPath), [...args, '.'], { stdio: 'inherit' });

      /** Stops the watch script when the application has been quit */
      electronApp.addListener('exit', process.exit);
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
    root: path.resolve('packages/renderer'),
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
  // 1. Create and start Vite dev server for the renderer
  const rendererWatchServer = await startRendererDevServer();

  // 2. Build independent plugins from factories
  const preloadReloaderPlugin = createPreloadReloaderPlugin(rendererWatchServer);
  const electronLauncherPlugin = createElectronLauncherPlugin();

  // 3. Watch and build packages with their respective plugins
  await build({
    mode: config.mode,
    root: path.resolve('packages/preload'),
    plugins: [preloadReloaderPlugin],
    build: {
      watch: {},
    },
  });
  await build({
    mode: config.mode,
    root: path.resolve('packages/main'),
    plugins: [electronLauncherPlugin],
    build: {
      watch: {},
    },
  });
}

startDevServer().catch((err) => {
  console.error('Failed to start development server:', err);
  process.exit(1);
});
