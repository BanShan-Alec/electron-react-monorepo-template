import { performance } from 'node:perf_hooks';

/**
 * Node.js 主进程 Event Loop 滞后实时采样器
 *
 * 采用 libuv check 阶段的 setImmediate 循环探测事件循环调度滞后，
 * 避免 Windows 平台下 monitorEventLoopDelay 受 15.6ms 操作系统定时器中断精度限制的问题。
 */
export class EventLoopLagMonitor {
  private maxLagMs = 0;
  private isSampling = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly sampleIntervalMs = 20;

  constructor() {
    this.start();
  }

  public start(): void {
    if (this.isSampling) return;
    this.isSampling = true;

    const sample = () => {
      if (!this.isSampling) return;
      const start = performance.now();
      setImmediate(() => {
        const delta = performance.now() - start;
        // setImmediate 在空闲事件循环中的固有开销通常 < 0.2ms，超出部分即为真正的事件循环排队阻塞
        const lag = Math.max(0, delta - 0.2);
        if (lag > this.maxLagMs) {
          this.maxLagMs = lag;
        }
        if (this.isSampling) {
          this.timer = setTimeout(sample, this.sampleIntervalMs);
          this.timer.unref();
        }
      });
    };

    sample();
  }

  public stop(): void {
    this.isSampling = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * 获取最近采样窗口内的最大滞后并重置统计
   */
  public getLagAndReset(): number {
    const lag = Math.round(this.maxLagMs * 10) / 10;
    this.maxLagMs = 0;
    // 小于 0.5ms 的微小波动直接归零，视为事件循环完全畅通
    return lag > 0.5 ? lag : 0;
  }
}

export const eventLoopMonitor = new EventLoopLagMonitor();
