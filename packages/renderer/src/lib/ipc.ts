import { APP_ENV } from '@app/shared/constants/env';
import type { Result } from '@shared/types/result';

/**
 * IPC 失败语义化错误：保留主进程 Result 契约中的 code，调用方可按错误码分支（如 DIVIDE_BY_ZERO），
 * 而不是解析错误文案。
 */
export class IpcError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'IpcError';
    this.code = code;
  }
}

// 私有常量
const IPC_LOG_PREFIX = '[ipc]';

// 可抽离的逻辑处理函数/组件
/**
 * 日志纪律：只记录 channel / 结果 / 耗时。
 * 成功行仅 dev 走 console（DevTools 观察，不落盘避免每次交互都产生文件行）；
 * 失败行走 logger——dev 附原始错误对象回显 + 落盘，生产一行带错误文案（code 不落盘），
 * 磁盘可查哪个 IPC 为什么失败过。
 * 严禁打印入参 body——config 含本地路径、dialog 含 URL。
 */
function logIpc(channel: string, ok: boolean, durationMs: number, error?: unknown) {
  const isDev = window.__APP_ENV__?.mode === APP_ENV.DEVELOPMENT;
  const cost = `${durationMs.toFixed(1)}ms`;
  if (ok) {
    if (isDev) {
      console.info(`${IPC_LOG_PREFIX} ${channel} ok ${cost}`);
    }
    return;
  }
  const line = `${IPC_LOG_PREFIX} ${channel} failed ${cost}`;
  if (isDev) {
    logger.warn(line, error);
    return;
  }
  const reason = error instanceof Error ? error.message : String(error);
  logger.warn(`${line}: ${reason}`);
}

type IpcService<TData, TParams extends unknown[]> = (...args: TParams) => Promise<Result<TData>>;

/**
 * 统一的 IPC 调用原语：Result 解构 + 计时 + 日志。
 * 成功返回解构后的 data，失败抛 IpcError（保留 code）。
 * feature 内禁止手写 window.api.* + if (!res.success)，一律经由本函数或 hooks/useIpc.ts。
 */
export async function callIpc<TData, TParams extends unknown[]>(
  channel: string,
  service: IpcService<TData, TParams>,
  args: TParams,
): Promise<TData> {
  const startedAt = performance.now();
  try {
    const res = await service(...args);
    if (!res.success) {
      throw new IpcError(res.error, res.code);
    }
    logIpc(channel, true, performance.now() - startedAt);
    return res.data;
  } catch (error) {
    logIpc(channel, false, performance.now() - startedAt, error);
    throw error;
  }
}
