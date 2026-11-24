import { callIpc } from '@/lib/ipc';

/**
 * 打开外部链接（浏览器/系统默认处理器）。
 *
 * 链接打开失败不打扰用户（含白名单拦截拒绝）：失败行已由 callIpc 统一落盘。
 */
export function openExternal(url: string): void {
  void callIpc('shell.openExternal', [url]).catch(() => {});
}
