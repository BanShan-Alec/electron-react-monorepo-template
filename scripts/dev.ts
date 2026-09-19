import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import electronPath from 'electron';
import { build, createServer, type Plugin, type ViteDevServer } from 'vite';

/**
 * Development Mode Orchestration Script
 *
 * 1. Set environment variables to indicate development mode.
 * 2. Start the Vite dev server for @app/renderer.
 * 3. Set VITE_DEV_SERVER_URL directly in process.env.
 * 4. Watch and build @app/preload with hot-reload trigger for webview.
 * 5. Watch and build @app/main with automatic Electron app process management.
 */

async function startDevServer() {
  const mode = 'development';
  process.env.NODE_ENV = mode;
  process.env.MODE = mode;

  // 1. Create and start Vite dev server for the renderer
  const rendererWatchServer: ViteDevServer = await createServer({
    mode,
    root: path.resolve('packages/renderer'),
  });

  await rendererWatchServer.listen();

  // 2. Set the renderer dev-server URL in process.env
  if (rendererWatchServer.resolvedUrls?.local?.[0]) {
    process.env.VITE_DEV_SERVER_URL = rendererWatchServer.resolvedUrls.local[0];
  }

  // 3. Define Preload reloader plugin that informs renderer webview on rebuilds
  const preloadReloaderPlugin: Plugin = {
    name: '@app/preload-dev-reloader',
    writeBundle() {
      rendererWatchServer.ws.send({
        type: 'full-reload',
      });
    },
  };

  // 4. Define Electron launcher plugin that manages Electron process lifecycle
  let electronApp: ChildProcess | null = null;

  const electronLauncherPlugin: Plugin = {
    name: '@app/main-electron-launcher',
    writeBundle() {
      /** Kill electron if a process already exists */
      if (electronApp !== null) {
        electronApp.removeListener('exit', process.exit);
        electronApp.kill('SIGINT');
        electronApp = null;
      }

      /** Spawn a new electron process */
      electronApp = spawn(String(electronPath), ['--inspect', '.'], {
        stdio: 'inherit',
      });

      /** Stops the watch script when the application has been quit */
      electronApp.addListener('exit', process.exit);
    },
  };

  // 5. Watch and build packages with their respective plugins
  await build({
    mode,
    root: path.resolve('packages/preload'),
    plugins: [preloadReloaderPlugin],
    build: {
      watch: {},
    },
  });

  await build({
    mode,
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
