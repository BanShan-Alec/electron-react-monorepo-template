import fs from 'node:fs';
import path from 'node:path';
import { protocol } from 'electron';
import type { AppModule } from '../AppModule';
import { serializeRuntimeEnvScript } from '../env';
import type { ModuleContext } from '../ModuleContext';
import { getLogManager } from './log.module';

const SCHEME = 'app';
const ENV_PLACEHOLDER = '<!-- __APP_ENV_INJECTION__ -->';

// 必须在 app.whenReady() 之前注册特权模式
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
};

export class ProtocolModule implements AppModule {
  private readonly logger = getLogManager().scoped('ProtocolModule');
  private readonly rendererDistDir: string;

  constructor(rendererDistDir: string) {
    this.rendererDistDir = path.normalize(rendererDistDir);
  }

  async enable({ app: electronApp }: ModuleContext): Promise<void> {
    await electronApp.whenReady();
    this.logger.info('Registering protocol handler for scheme:', SCHEME);

    protocol.handle(SCHEME, async (request) => {
      try {
        const parsedUrl = new URL(request.url);
        let pathname = decodeURIComponent(parsedUrl.pathname);
        if (pathname.startsWith('/')) {
          pathname = pathname.slice(1);
        }
        if (!pathname || pathname === '') {
          pathname = 'index.html';
        }

        const filePath = path.normalize(path.join(this.rendererDistDir, pathname));
        const distRootWithSep = this.rendererDistDir.endsWith(path.sep)
          ? this.rendererDistDir
          : `${this.rendererDistDir}${path.sep}`;

        // 防止路径遍历攻击
        if (filePath !== this.rendererDistDir && !filePath.startsWith(distRootWithSep)) {
          this.logger.warn(`Disallowed path traversal attempt: ${filePath}`);
          return new Response('Forbidden', { status: 403 });
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        // 如果是 HTML 请求，动态替换占位符并注入不可变环境基座脚本
        if (ext === '.html') {
          const rawHtml = await fs.promises.readFile(filePath, 'utf-8');
          const injectedScript = serializeRuntimeEnvScript();
          const injectedHtml = rawHtml.includes(ENV_PLACEHOLDER)
            ? rawHtml.replace(ENV_PLACEHOLDER, injectedScript)
            : rawHtml.replace('<head>', `<head>\n    ${injectedScript}`);

          return new Response(injectedHtml, {
            status: 200,
            headers: {
              'content-type': 'text/html; charset=utf-8',
            },
          });
        }

        // 静态文件直接由 Node.js fs 读取并返回相应 MIME 流 (原生兼容本地与 asar)
        const fileBuffer = await fs.promises.readFile(filePath);
        return new Response(fileBuffer, {
          status: 200,
          headers: {
            'content-type': contentType,
          },
        });
      } catch (err) {
        this.logger.error(`Failed to handle protocol request: ${request.url}`, err);
        return new Response('Not Found', { status: 404 });
      }
    });
  }
}

export function createProtocolModule(rendererDistDir: string): ProtocolModule {
  return new ProtocolModule(rendererDistDir);
}
