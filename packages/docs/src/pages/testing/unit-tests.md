# 单元测试（Vitest）

> **TL;DR**：一套 Vitest 配置按环境变量切分单测与 benchmark 范围，纯逻辑测试直接对边界取值。

## 要解决的坑

Electron 项目做测试，坑大多出在「边界」上：

- 测试配置不好组织：单测、benchmark 的收录范围不同，工具链包还得和业务测试隔离开

## 本仓库的解法

### 1. 单测兜底纯逻辑：一套配置圈定范围

→ 源码：[.config/vitest.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.config/vitest.config.ts)

```ts
const isBenchmark = process.env.BENCHMARK === 'true';

export default defineConfig({
  root: rootDir,
  test: {
    environment: 'node',
    globals: true,
    include: isBenchmark
      ? ['packages/main/tests/benchmark/**/*.test.ts']
      : ['packages/**/tests/unit/**/*.test.ts', 'packages/**/tests/**/*.test.ts'],
    exclude: isBenchmark
      ? ['**/node_modules/**', '**/dist/**']
      : [
          '**/node_modules/**',
          '**/dist/**',
          'packages/main/tests/benchmark/**',
          'packages/pr-review/**',
        ],
  },
});
```

单测跑在 `node` 环境（不引 jsdom），`packages/**/tests/**` 全量收录；benchmark 与 `@app/pr-review` 在 exclude 里点名排除，各自单独触发。配置文件放在 `.config/` 而非根目录，`root` 由 `findRepoRoot` 从配置文件自身位置向上推导，不依赖启动时的工作目录。

（benchmark 的单独触发方式见[性能基线（Benchmark）](/testing/performance-baseline)。）

纯逻辑测试直接对边界取值，以渲染日志行截断为例：

→ 源码：[packages/main/tests/unit/renderer-log-line.test.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/tests/unit/renderer-log-line.test.ts)

```ts
it('should truncate over-long lines and keep the total length within max', () => {
  const line = 'x'.repeat(2500);
  const result = truncateRenderedLine(line);
  const suffix = ' [truncated 500 chars]';

  expect(result).toContain(`[truncated ${500} chars]`);
  expect(result.length).toBe(RENDERER_LINE_MAX_LENGTH);
  expect(result.endsWith(suffix)).toBe(true);
  expect(result.startsWith('x'.repeat(RENDERER_LINE_MAX_LENGTH - suffix.length))).toBe(true);
});
```

`RENDERER_LINE_MAX_LENGTH` 从源码常量导入而不是在测试里重写一份——常量调整时测试自动跟随，不会锁死旧值。同类兜底还有 W3C traceparent 编解码 roundtrip、日志归档按类别保留上限、更新错误码归类等，分布在 `packages/main/tests/unit/` 与 `packages/shared/tests/unit/`。

## 怎么抄

以「给一个功能补测试」为例，按要验证的东西选层：

1. **纯逻辑**：在对应包建 `tests/unit/xxx.test.ts`（主进程在 `packages/main/tests/unit/`，shared 在 `packages/shared/tests/unit/`），根目录 `pnpm test` 自动收录；依赖 `electron` 的模块照第 2 节打桩，不启动运行时

（`electron` 模块的打桩手法见[主进程单元测试（EventEmitter）](/testing/main-process-tests)。）

注意点：

- 单测环境是 `node` 而非 jsdom，DOM 行为全部归 E2E 的真实窗口
