import fs from 'node:fs';
import path from 'node:path';
import { protocol } from 'electron';
import type { AppModule } from '../AppModule';
import { serializeRuntimeEnvScript } from '../env';
import type { ModuleContext } from '../ModuleContext';
import { getLogManager } from './log.module';

const SCHEME = 'app';
const ENV_PLACEHOLDER = '<!-- __APP_ENV_INJECTION__ -->';

// 在模块加载时预先注册特权模式（若尚未就绪），并在 enable() 中保留幂等防护
try {
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
} catch {
  // 若在测试或动态加载中已就绪，忽略重复注册异常
}

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
    this.rendererDistDir = path.resolve(rendererDistDir);
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
        if (!pathname || pathname === '' || pathname.endsWith('/')) {
          pathname = path.join(pathname, 'index.html');
        }

        let filePath = path.resolve(this.rendererDistDir, pathname);

        // 使用相对路径判断防止跨平台大小写不一致导致的路径遍历越界或误判
        const relativePath = path.relative(this.rendererDistDir, filePath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          this.logger.warn(`Disallowed path traversal attempt: ${filePath}`);
          return new Response('Forbidden', { status: 403 });
        }

        // 若请求路径对应一个目录，自动 fallback 到目录下的 index.html
        try {
          const stats = await fs.promises.stat(filePath);
          if (stats.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
          }
        } catch {
          // 若直接路径不存在且没有扩展名，fallback 到根 index.html 支撑 SPA 路由
          if (!path.extname(filePath)) {
            filePath = path.join(this.rendererDistDir, 'index.html');
          }
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        // 如果是 HTML 请求，动态替换占位符并注入不可变环境基座脚本
        if (ext === '.html') {
          const rawHtml = await fs.promises.readFile(filePath, 'utf-8');
          const injectedScript = serializeRuntimeEnvScript();
          let injectedHtml = rawHtml;
          if (injectedHtml.includes(ENV_PLACEHOLDER)) {
            injectedHtml = injectedHtml.replaceAll(ENV_PLACEHOLDER, injectedScript);
          } else if (/<head[^>]*>/i.test(injectedHtml)) {
            injectedHtml = injectedHtml.replace(/(<head[^>]*>)/i, `$1\n    ${injectedScript}`);
          } else {
            injectedHtml = `${injectedScript}\n${injectedHtml}`;
          }

          return new Response(injectedHtml, {
            status: 200,
            headers: {
              'content-type': 'text/html; charset=utf-8',
              'cache-control': 'no-cache, no-store, must-revalidate',
            },
          });
        }

        // 静态文件直接由 Node.js fs 读取并返回相应 MIME 流与强缓存
        const fileBuffer = await fs.promises.readFile(filePath);
        return new Response(fileBuffer, {
          status: 200,
          headers: {
            'content-type': contentType,
            'cache-control': 'public, max-age=31536000, immutable',
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
