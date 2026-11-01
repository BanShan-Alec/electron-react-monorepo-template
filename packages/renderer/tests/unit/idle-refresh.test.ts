import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIdleRefresh } from '../../src/features/system-info/lib/createIdleRefresh';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('system info idle refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips interval ticks while a refresh is pending and resumes after it settles', async () => {
    const first = createDeferred<void>();
    const second = createDeferred<void>();
    const refreshRequest = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const refresh = createIdleRefresh(refreshRequest);
    const interval = setInterval(refresh, 1000);

    await vi.advanceTimersByTimeAsync(3000);
    expect(refreshRequest).toHaveBeenCalledTimes(1);

    first.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1000);
    expect(refreshRequest).toHaveBeenCalledTimes(2);

    clearInterval(interval);
    second.resolve();
    await Promise.resolve();
  });

  it('allows another attempt after a failed refresh settles', async () => {
    const refreshRequest = vi
      .fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(undefined);
    const refresh = createIdleRefresh(refreshRequest);

    refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshRequest).toHaveBeenCalledTimes(1);

    refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshRequest).toHaveBeenCalledTimes(2);
  });
});
