import { beforeEach, describe, expect, it, vi } from 'vitest';

const listenersMap = new Map<string, Set<(...args: unknown[]) => void>>();

vi.mock('electron', () => ({
  ipcRenderer: {
    on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
      let set = listenersMap.get(channel);
      if (!set) {
        set = new Set();
        listenersMap.set(channel, set);
      }
      set.add(listener);
    }),
    removeListener: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
      listenersMap.get(channel)?.delete(listener);
    }),
  },
}));

function emitIpc(channel: string, data: unknown) {
  const set = listenersMap.get(channel);
  if (set) {
    for (const listener of set) {
      listener({}, data);
    }
  }
}

describe('createStickyChannel (Preload 粘性事件通道)', () => {
  beforeEach(() => {
    listenersMap.clear();
    vi.clearAllMocks();
  });

  it('监听器先于事件注册时，正常实时接收推送', async () => {
    const { createStickyChannel } = await import('../../src/sticky');
    const subscribe = createStickyChannel<{ status: string }>('test:event');

    const received: string[] = [];
    const unsubscribe = subscribe((data) => {
      received.push(data.status);
    });

    emitIpc('test:event', { status: 'first' });
    emitIpc('test:event', { status: 'second' });

    expect(received).toEqual(['first', 'second']);
    unsubscribe();
  });

  it('事件先于监听器到达时，新监听器注册即刻通过微任务收到回放', async () => {
    const { createStickyChannel } = await import('../../src/sticky');
    const subscribe = createStickyChannel<{ count: number }>('test:sticky');

    // 主进程提前推送（例如窗口创建期间先于 React 挂载到达）
    emitIpc('test:sticky', { count: 42 });

    const received: number[] = [];
    // 渲染层 React 组件稍后挂载并注册监听
    const unsubscribe = subscribe((data) => {
      received.push(data.count);
    });

    // 尚未经过微任务周期时，回调尚未触发
    expect(received).toEqual([]);

    // 经历微任务后收到重放
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(received).toEqual([42]);

    // 后续新事件正常广播
    emitIpc('test:sticky', { count: 100 });
    expect(received).toEqual([42, 100]);

    unsubscribe();
  });

  it('解绑后不再接收新推送与微任务回放', async () => {
    const { createStickyChannel } = await import('../../src/sticky');
    const subscribe = createStickyChannel<string>('test:unsub');

    emitIpc('test:unsub', 'stale');

    const received: string[] = [];
    const unsubscribe = subscribe((data) => {
      received.push(data);
    });

    // 立即解绑
    unsubscribe();

    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(received).toEqual([]);

    emitIpc('test:unsub', 'new');
    expect(received).toEqual([]);
  });

  it('订阅到回放之间到达新事件时，跳过过期缓存避免状态倒退', async () => {
    const { createStickyChannel } = await import('../../src/sticky');
    const subscribe = createStickyChannel<{ version: number }>('test:race');

    emitIpc('test:race', { version: 1 });

    const received: number[] = [];
    subscribe((data) => {
      received.push(data.version);
    });

    // 微任务尚未执行，更新的事件先到：实时路径已投递 v2
    emitIpc('test:race', { version: 2 });
    expect(received).toEqual([2]);

    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    // 旧缓存 v1 不得覆盖已送达的 v2
    expect(received).toEqual([2]);
  });

  it('回放路径捕获回调异常，不产生未处理拒绝', async () => {
    const { createStickyChannel } = await import('../../src/sticky');
    const subscribe = createStickyChannel<string>('test:throw');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    emitIpc('test:throw', 'payload');
    subscribe(() => {
      throw new Error('renderer boom');
    });

    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
