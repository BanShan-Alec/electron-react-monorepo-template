import { describe, expect, it } from 'vitest';
import { getTracer } from '../../packages/main/src/telemetry/tracer';

describe('Performance Benchmark (Spec §6)', () => {
  it('adds less than 0.1ms jitter overhead per call over 10,000 invocations', async () => {
    const tracer = getTracer();
    const ITERATIONS = 10000;

    // 1. 基准运行：直接执行 10,000 次纯内存异步调用
    const baseStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      await (async (val: number) => val * 2)(i);
    }
    const baseDuration = performance.now() - baseStart;

    // 2. 遥测运行：包裹在 startActiveSpan 中执行 10,000 次调用
    const traceStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      await tracer.startActiveSpan(
        'benchmark.operation',
        { attributes: { index: i } },
        async () => {
          return (async (val: number) => val * 2)(i);
        },
      );
    }
    const traceDuration = performance.now() - traceStart;

    const totalOverheadMs = traceDuration - baseDuration;
    const perCallOverheadMs = totalOverheadMs / ITERATIONS;

    console.log(`[Benchmark] 10,000 base calls: ${baseDuration.toFixed(2)}ms`);
    console.log(`[Benchmark] 10,000 traced calls: ${traceDuration.toFixed(2)}ms`);
    console.log(`[Benchmark] Total overhead: ${totalOverheadMs.toFixed(2)}ms`);
    console.log(`[Benchmark] Per-call overhead: ${perCallOverheadMs.toFixed(4)}ms/call`);

    // 验收指标：每调用附加时延抖动低于 0.1ms/次
    expect(perCallOverheadMs).toBeLessThan(0.1);
  });
});
