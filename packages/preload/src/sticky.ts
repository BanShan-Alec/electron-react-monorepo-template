import { ipcRenderer } from 'electron';

/**
 * 创建基于 Preload 闭包的粘性事件通道（Sticky Event Channel）
 *
 * 核心机制：
 * 1. Preload 加载后常驻监听目标 IPC 通道，自动缓存最新的事件数据；
 * 2. 任何新监听器注册时，若已有已到达的缓存事件，立即通过微任务（queueMicrotask）向其重放；
 * 3. 彻底消除主进程先发推与渲染层 React 挂载迟到导致的时序竞争（Race Condition）。
 */
export function createStickyChannel<T>(
  channel: string,
): (callback: (data: T) => void) => () => void {
  let latestData: T | null = null;
  const listeners = new Set<(data: T) => void>();

  ipcRenderer.on(channel, (_event: Electron.IpcRendererEvent, data: T) => {
    latestData = data;
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (err) {
        console.error(`[preload] Error in sticky listener for "${channel}":`, err);
      }
    }
  });

  return (callback: (data: T) => void): (() => void) => {
    listeners.add(callback);

    if (latestData !== null) {
      const cached = latestData;
      queueMicrotask(() => {
        if (listeners.has(callback)) {
          callback(cached);
        }
      });
    }

    return () => {
      listeners.delete(callback);
    };
  };
}
