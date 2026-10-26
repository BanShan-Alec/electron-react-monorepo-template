---
title: 性能基线（Benchmark）
description: benchmark 单独成套，用同构循环断言单次调用开销上界，默认门禁不跑。
---

# 性能基线（Benchmark）

> **TL;DR**：benchmark 单独成套，用同构循环断言单次调用开销上界，默认门禁不跑。

## 要解决的坑

- 性能退化（比如遥测埋点引入的抖动）平时无感，没有基线就永远发现不了

## 本仓库的解法

### 5. 性能基线：benchmark 单独成套，默认门禁不跑

→ 源码：[packages/main/tests/benchmark/tracer-perf.test.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/tests/benchmark/tracer-perf.test.ts)

```ts
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
```

对照组与实验组循环同构，总时长差值摊到单次开销上断言上界——遥测埋点只要引入超过 0.1ms/次 的抖动就红。这个文件不进默认套件：`pnpm test` 的 exclude 把 `packages/main/tests/benchmark/**` 点名排除，只有 `BENCHMARK=true`（`pnpm test:bench`）才切换 include 收录它；仓库的全部 CI workflow 也没有任何 benchmark 步骤，它只在本地按需运行。

## 怎么抄

性能基线的接入步骤：

3. **性能基线**：在 `packages/main/tests/benchmark/` 建 `xxx.test.ts`，对照组/实验组同构循环、断言单次开销上界；`pnpm test:bench` 单独触发

注意点：

- benchmark 与 pr-review 不在 `pnpm test` 默认范围里，门禁不会替你跑性能基线
