import { session } from 'electron';
import type { AppModule } from '../../AppModule';
import type { ModuleContext } from '../../ModuleContext';
import { getLogManager } from '../log.module';

/**
 * CSP 安全模块：
 * 统一拦截 session 请求响应头，注入 Content-Security-Policy，
 * 解决渲染进程安全告警 (Insecure Content-Security-Policy)，同时兼容开发调试环境 (Vite/HMR) 及基础外链资源。
 */
export class ContentSecurityPolicyModule implements AppModule {
  private readonly logger = getLogManager().scoped('ContentSecurityPolicy');

  enable({ app }: ModuleContext): Promise<void> | void {
    app.on('ready', () => {
      this.setupCSP();
    });
  }

  private setupCSP(): void {
    const defaultSession = session.defaultSession;
    if (!defaultSession) {
      this.logger.warn('defaultSession is not available to configure CSP.');
      return;
    }

    const isDev = !import.meta.env.PROD;

    // 标准宽松策略：允许自身、内联脚本/样式、eval、data/blob 协议、https 外部资源；
    // 开发环境下额外允许 ws:// 和 http: 以支持 Vite HMR 和本地开发服务器
    const cspPolicy = isDev
      ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: http: ws:;"
      : "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:;";

    defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = { ...details.responseHeaders };

      responseHeaders['Content-Security-Policy'] = [cspPolicy];

      callback({ responseHeaders });
    });

    this.logger.info(`Content-Security-Policy configured (isDev=${isDev}): ${cspPolicy}`);
  }
}

export function createContentSecurityPolicyModule(): ContentSecurityPolicyModule {
  return new ContentSecurityPolicyModule();
}
