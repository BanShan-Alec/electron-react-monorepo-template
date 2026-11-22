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
        // 引用相等守卫：订阅到重放之间若有新事件送达，实时路径已投递更新的数据，
        // 此时重放旧缓存会让监听器状态倒退；IPC 每次投递都是新对象，同值不会误判
        if (listeners.has(callback) && latestData === cached) {
          try {
            callback(cached);
          } catch (err) {
            console.error(`[preload] Error in sticky listener for "${channel}":`, err);
          }
        }
      });
    }

    return () => {
      listeners.delete(callback);
    };
  };
}
