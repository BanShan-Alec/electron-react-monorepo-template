# 测试矩阵

单测、E2E、性能基线三层测试，各管一段：纯逻辑用 Vitest 兜底，黑盒行为用 Playwright 拉起真实 Electron 窗口，关键路径开销用 benchmark 模式盯回归；工具链包的测试独立成套、互不拖累。

## 收录的解法

- [单元测试（Vitest）](/testing/unit-tests)：一套 Vitest 配置按环境变量切分单测与 benchmark 范围，纯逻辑测试直接对边界取值。
- [主进程单元测试（EventEmitter 打桩）](/testing/main-process-tests)：用 EventEmitter 顶替 `app`、在模块边界换桩，不启动 Electron 也能验证生命周期。
- [端到端测试（Playwright）](/testing/e2e-electron)：Playwright 官方 `_electron` 拉起真实窗口，worker 级夹具单次冷启动并隔离用户数据目录。
- [端到端断言策略（shell 打桩 + 容差）](/testing/e2e-assertions)：启动阶段整体替换 `shell` 模块，断言只锁协议与最终态，数值断言带容差。
- [性能基线（Vitest benchmark）](/testing/performance-baseline)：benchmark 单独成套，用同构循环断言单次调用开销上界，默认门禁不跑。
- [产物冒烟测试（dist 启动验证）](/testing/artifact-smoke)：打包后真实拉起解包产物，等 React `#root` 挂载成功，跑不起来的环境显式跳过。

这套矩阵的答案：一个 Vitest 配置用环境变量切分单测/benchmark 两套范围；E2E 走 Playwright 官方 `_electron` API 加 worker 级夹具，用例间复用同一次冷启动；性能基线单独成套按需触发；工具链包自带配置、自带命令。
