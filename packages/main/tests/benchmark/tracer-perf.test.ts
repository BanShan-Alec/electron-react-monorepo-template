import { getTracer } from '@app/main/telemetry/tracer';
import { describe, expect, it } from 'vitest';

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

    // 3. 计算单次调用的附加遥测开销（Overhead per invocation）
    const totalOverhead = traceDuration - baseDuration;
    const overheadPerCallMs = totalOverhead / ITERATIONS;

    // 4. 断言单次平均开销低于 0.1ms
    expect(overheadPerCallMs).toBeLessThan(0.1);
  });
});
