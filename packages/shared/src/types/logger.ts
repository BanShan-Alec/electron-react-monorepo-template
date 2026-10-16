/**
 * 渲染进程全局 logger 契约：contextBridge 暴露为 window.logger，
 * 并经 env.d.ts 的 declare const 支持裸调用（logger.info(...)）。
 * 形态与主进程 IScopedLogger 逐字一致——方法名即级别、变参、同步 void；
 * 底层由 preload 走 diagnostics:log 通道落盘，fire-and-forget，调用方不感知 IPC 成败。
 */
export interface LoggerApi {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}
