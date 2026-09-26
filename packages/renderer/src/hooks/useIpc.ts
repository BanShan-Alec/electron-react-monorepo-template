import type { Result } from '@shared/types/result';
import type { UseManualRequestOptions, UseManualRequestResult } from '@/hooks/useManualRequest';
import { useManualRequest } from '@/hooks/useManualRequest';
import { callIpc } from '@/lib/ipc';

/**
 * 单一 IPC channel 的请求 hook = useManualRequest + callIpc。
 * TData / TParams 直接由 api 函数签名推导（window.api.x.y: (...args) => Promise<Result<TData>>），
 * 拿到的 data 即解构后的 TData，无需手写 Result 解构与类型断言。
 *
 * 只用于“一次请求对一个 channel”。多 channel 编排（一个动作路由多个接口）改用 useManualRequest，
 * service 内部用 callIpc 拼装。
 */
export function useIpc<TData, TParams extends unknown[]>(
  channel: string,
  service: (...args: TParams) => Promise<Result<TData>>,
  options?: UseManualRequestOptions<TData, TParams>,
): UseManualRequestResult<TData, TParams> {
  return useManualRequest<TData, TParams>(async (...args: TParams) => {
    return callIpc(channel, service, args);
  }, options);
}
