# 客户端日志与异常防护整改规范 (Logging & Exception Hardening Spec)

> 版本：v1 | 状态：设计定稿
> 上游需求：[logging-and-exception-audit.md](../docs/logging-and-exception-audit.md)（多维度工程审查）。本文只收录**经源码与官方文档核查后仍然成立**的整改项；已被核查推翻的论断见 §Out of Scope 与 §Further Notes，禁止未来实施时复用误信。
> 关联：[README](../README.md)（IPC 拓扑与分层架构）· [e2e/first-screen.spec.ts](../e2e/first-screen.spec.ts)（AC 断言与分层验收先例）

---

## 问题陈述 (Problem Statement)

从使用者的视角，当前客户端在稳定性与可调试性上存在系统性缺口：

1. **一条非致命错误就能杀死整个应用**：任何未处理的 Promise 拒绝（如一次背景轮询漏抓）都会触发弹窗 + 强制退出，用户正在进行的操作状态直接丢失。
2. **崩溃后没有原地恢复能力**：渲染进程 OOM 或崩溃时窗口死白假死，用户只能手动重启，无"重新载入"选项。
3. **失控日志可以打爆磁盘与内存**：渲染端日志通道对消息长度、发送频率、敏感内容均无防护——超大 payload 全量落盘、死循环调用拖垮主进程、密码/token 以明文永久留在本地日志。
4. **历史日志名存实亡**：轮转归档永远只有一份（后续轮转直接覆盖前一份），配置的"保留 5 份"形同虚设，排查历史问题无据可查。
5. **跨进程日志无法关联**：`main.log` 与 `renderer.log` 各自独立，同一次运行的两条日志流无法确认属于同一次会话。
6. **生产异常无法还原源码**：Sentry 未绑定版本 release，未来上传 SourceMap 后也无法精确匹配到出错的构建。

## 方案 (Solution)

对日志与异常体系做一次**分级 + 硬化 + 关联**整改：异常按致命性分级（同步崩溃仍弹窗退出，Promise 漏抓只记录不退出）；渲染端日志通道加输入硬化（长度硬上限、滑动窗口节流、敏感键脱敏、meta 序列化截断）；归档轮转改为时间戳命名真实留存；渲染进程死亡提供"重新载入"弹窗恢复；全链路日志统一携带会话 ID；Sentry 绑定版本 release。

## 用户故事 (User Stories)

1. 作为桌面用户，我希望偶发的未处理 Promise 拒绝只被记录而不退出应用，这样我正在进行的操作不会因一次背景请求失败而全部丢失。
2. 作为桌面用户，我希望渲染进程崩溃或内存溢出时收到"重新载入"弹窗并能在原窗口恢复，这样我不必重启整个应用。
3. 作为桌面用户，我希望渲染端失控（死循环/恶意注入）产生的日志洪流被主进程拦截，这样整机不掉帧假死、磁盘不被写爆。
4. 作为桌面用户，我希望我的密码、token 等敏感信息永远不会以明文留在本地日志文件中，这样日志泄露不构成凭证泄露。
5. 作为支持工程师，我希望同一次运行产生的所有日志行共享同一个会话 ID，这样我能一眼串起 main 与 renderer 两条日志流的先后因果。
6. 作为支持工程师，我希望磁盘上真实存在按时间命名的历史归档（7 天内最多 5 份），这样我能排查"昨天还好好的、今天坏了"这类跨时段问题。
7. 作为支持工程师，我希望渲染进程死亡事件（原因 crashed/oom）被写入 main.log，这样用户报障时我能拿到死亡原因而非只有"白屏了"。
8. 作为支持工程师，我希望应用退出（before-quit / will-quit）被记录，这样我能区分"用户正常退出"与"异常终止"。
9. 作为开发者，我希望 `uncaughtException` 与 `unhandledRejection` 走不同的处理分支，这样致命崩溃的处置语义不会被非致命错误稀释。
10. 作为开发者，我希望超过 2000 字符的日志消息在 IPC 入口就被语义化错误码拒绝，这样调用方能在开发期就发现自己在滥用日志通道。
11. 作为开发者，我希望日志节流的超限行为是"丢弃 + 一条汇总告警"，这样洪流既不会刷爆磁盘，也不会让我完全看不到洪流发生过。
12. 作为开发者，我希望超大的 `meta` 对象在序列化后被截断到安全长度并带截断标记，这样单条日志的体积上界是可预期的。
13. 作为开发者，我希望业务 IPC 控制器（dialog/counter 等）有主进程日志沉淀，这样排查 IPC 问题时不出现链路断档。
14. 作为开发者，我希望所有新日志能力经由既有的 `Result` 错误码契约与 `scoped()` 日志原语，这样不引入第二套错误/日志范式。
15. 作为开发者，我希望生产环境 Sentry 事件绑定 `electron-app@<version>` 的 release 标识，这样崩溃事件能精确归因到构建版本。
16. 作为安全审计者，我希望脱敏是写入前的强制环节而非调用方自觉，这样任何调用路径都无法绕过。
17. 作为安全审计者，我希望节流与长度上限作用于 IPC 入口层，这样它们不受渲染端代码是否可信的影响。
18. 作为安全审计者，我希望 fatal-crash 落盘路径在应用任何生命周期阶段都可用且有兜底，这样崩溃信息本身不会因崩溃而丢失。
19. 作为运维者，我希望清理策略（过期天数 + 归档份数）与新的归档命名模式真正配套生效，这样磁盘占用有界。
20. 作为维护者，我希望渲染进程死亡处置尊重"最小化到托盘"等既有生命周期语义（退出中不弹窗、已销毁不操作），这样新增监听不会制造僵尸窗口。

## 实现决策 (Implementation Decisions)

| # | 决策 | 理由 |
| :--- | :--- | :--- |
| D1 | **异常分级**：`uncaughtException` 维持现状（同步落 fatal-crash.log + `showErrorBox` + `exit(1)`）；`unhandledRejection` 改为**仅记录**——带完整 reason 栈写 error 级日志，不弹窗、不退出 | 同步栈崩溃后内存状态不可信，必须退出；Promise 漏抓不影响事件循环健康，强杀纯属误伤。云端上报依赖主进程 Sentry（本期未引入，见 Out of Scope） |
| D2 | **消息长度硬上限**：`logInputSchema.message` 增加 `.max(2000)`；超限经既有 `Result` 契约返回 `VALIDATION_ERROR` 语义错误码，不落盘 | 拦截大 payload 的第一道闸放在 schema 层（IPC 入口），与既有校验范式同构；语义错误码让调用方可分支处理 |
| D3 | **滑动窗口节流**：`DiagnosticsService` 内实现每调用方 50 条/秒的滑动窗口计数；键为 `webContents.id`（控制器需把 `event.sender.id` 传入服务层，属签名变更）；超限静默丢弃并**只打印一条**汇总告警（含丢弃数量）；窗口滑过后自动恢复，无需重置 | 防洪闸放服务层而非控制器，保证计数逻辑与 Electron 类型解耦；单条汇总避免告警本身成为新洪流；按 webContents 分键天然覆盖未来的多窗口 |
| D4 | **meta 脱敏与体积截断**：写盘前对 `meta` 执行浅层键脱敏（键名大小写不敏感匹配 `password` / `authorization` / `token`，值替换为 `'***'`）；随后安全序列化（`JSON.stringify` 包 try/catch，循环引用降级为占位串）并截断到 8KB，截断处追加明确标记 | 脱敏在服务层强制执行（调用方无法绕过）；只做浅层遍历，避免深递归被构造性拖垮；体积截断补齐 schema 层管不到的 `meta` 缺口 |
| D5 | **真实归档轮转**：为 main/renderer 两条文件流自定义 `archiveLogFn`，轮转时按时间戳重命名（如 `main-2026-10-05-12-00-00.log`）；`cleanOldLogs` 的匹配规则**同步**从 `.includes('.old')` 改为新命名模式，保留 7 天 / 5 份策略不变 | electron-log 5.4.4 源码（`src/node/transports/file/index.js` L45-55）证实默认归档就是固定 `*.old.log` 覆盖写——此为已核查事实。清理规则若不同步改，新命名归档将完全脱离清理（现按 `.old` 过滤匹配不到新名），比不修更危险 |
| D6 | **渲染进程死亡恢复**：监听 `render-process-gone`，当 `reason` 为 `crashed` 或 `oom` 时弹 `dialog.showMessageBox`（「重新载入 / 退出」）；选择重载则 `webContents.reload()`。守卫三条：`win.isDestroyed()` 不操作、`reason === 'clean-exit'` 跳过、`appLifecycle.isQuitting` 时跳过。`preload-error` 已有逐窗口监听，不重复建设 | 原生对话框让用户自己决定是否重载，天然避免崩溃循环（每次崩溃都回到用户手上）；守卫防止关窗竞态与退出期僵尸弹窗 |
| D7 | **会话 ID 关联**：主进程启动时生成 `crypto.randomUUID()` 前 8 位作为 sessionId，main/renderer 两条文件流的格式统一追加 `[{session-xxxxxxxx}]` 段；每次启动新会话 | 会话在主进程单点生成，双流天然共享；8 位短 ID 足够区分会话且不撑爆行宽；随启动重建，无需持久化 |
| D8 | **Sentry release 绑定**：渲染端 Vite `define` 注入 `VITE_APP_VERSION`（取根 package.json 的 version），`Sentry.init` 增加 `release: 'electron-app@<version>'`。仅渲染端；主进程与 CI SourceMap 上传链路不在本期 | release 是 SourceMap 精确匹配的前提；版本注入走构建期 define，与既有 env 机制同源；主进程无 Sentry SDK、仓库无 DSN 供给，先建链路只会是空转 |
| D9 | **控制器日志补齐与退出闭环**：业务控制器经 `scoped()` 补主进程日志，延续 renderer `ipc.ts` 已成文的纪律——**只记 channel / 结果 / 耗时，严禁打印入参 body**（config 含本地路径、dialog 含 URL）；`lifecycle.ts` 在 before-quit / will-quit 记录退出动作 | 补的是观测盲区而非新范式；打印纪律已有成文先例，直接沿用防止把敏感参数从渲染端 console 搬进磁盘日志 |
| D10 | **不新建日志基础设施**：节流、脱敏、sessionId 均在既有 `LogManager` / `DiagnosticsService` 内实现；不引入单元测试运行器、不新建独立日志模块 | 仓库现行分层（AppModule + Service + Controller）已能承载全部需求；skill 原则"缝越少越好"，现有缝足够 |

## 测试决策 (Testing Decisions)

**好测试的标准**：只断言外部可观察行为——IPC 返回的 `Result`、磁盘日志文件内容、崩溃后窗口是否恢复可用；不断言内部计数器、私有字段或日志行数等实现细节。

**测试缝（全部为既有缝，不新建）**：

1. **IPC 缝（最高缝）**：e2e 经渲染端 `window.api.diagnostics.log` 触发，断言返回的 `Result`（超长消息被 `VALIDATION_ERROR` 拒绝）。
2. **文件系统缝**：经既有 `electronApp.evaluate` 定位日志目录，直接读 `main.log` / `renderer.log` 断言内容——脱敏（发送含 password 的 meta，断言磁盘上只有 `***` 无原值）、sessionId（同一运行的所有行共享同一 session 段）、节流（短时间灌入 200 条，断言落盘条数有界且存在恰好一条汇总告警）、归档清理（在日志目录植入伪造的过期/超额归档文件，经 evaluate 调用公开的清理方法，断言按 7 天 / 5 份正确淘汰）。
3. **崩溃缝**：`webContents.forcefullyCrashRenderer()`（Playwright Electron 既有 API）触发真实渲染进程死亡；e2e 内经 `electronApp.evaluate` 把 `dialog.showMessageBox` 桩化为返回「重新载入」，断言窗口重载后页面恢复可用且 main.log 出现死亡原因记录。**原生对话框本身的人类交互体验不自动化**。

**人工目测清单**（沿用 first-screen spec D7 的分层验收先例）：崩溃弹窗的按钮文案与聚焦行为、归档轮转的实时触发（5MB 满触发在 e2e 中不可行）、节流窗口的体感流畅度。

**既有测试资产与注意点**：夹具为 worker 级单次启动（`e2e/helpers/fixture.ts`），跨 spec 共享同一 Electron 实例——节流用例灌入的日志与计数状态会泄漏到后续 spec，用例设计须自包含（计数窗口自然衰减 + 日志断言只锚定本用例注入的特征串）；主进程错误对 e2e 是盲区（历史已知），凡主进程侧断言一律走文件缝而非控制台输出。

## Out of Scope（禁止顺手实现）

1. **主进程 Sentry SDK 与云端上报**：仓库未安装主进程 SDK、无 DSN 供给链路；D1 的 Promise 漏抓本期只落本地日志。云端闭环待 Sentry 主进程集成独立立项。
2. **CI SourceMap 上传管线**：依赖 Sentry 组织与凭据供给（env 注入未定），且 CI/CD 改造已另行定稿；本期仅落地 release 标识为未来上传铺路。
3. **审计文档维度七中已被核查推翻/已解决的项**：main 包 `console.*` 混用（现状为零）、`scoped()` 落地（已在 9 个模块使用）、`ipc.module` 双日志冗余（已收敛为单条）、渲染端生产环境 IPC 刷屏（现行代码成功日志仅 DEV 记录）、`app.getPath('userData')` ready 前异常（Electron 官方文档无此限制，且现行 `handleFatalCrash` 已有 try/catch 双层兜底）。
4. **日志查看器 UI / 日志导出分享**：`openLogFolder` 已满足需求。
5. **Session Replay 与 breadcrumbs 调优**：`sentry.ts` 注释已留开关，按需独立决策。
6. **审计文档中的示例代码照抄**：审计给出的 `archiveLogFn` 片段用 `renameSync` + ISO 时间戳，实施时须对齐本仓的清理规则与 biome 规范（如异步 fs、跨平台文件名合法性），片段仅表达意图。

## 进一步说明 (Further Notes)

- **核查记录**（对照"用户提供的文档不作可信来源"规则逐项验证）：
  - electron-log **5.4.4**（`node_modules/.pnpm` 实际安装版）源码证实：默认 `archiveLogFn` 固定重命名为 `*.old.log`（libuv `renameSync` 带替换语义，Windows 亦覆盖）；本仓 `maxSize` 已设 5MB（默认实为 1MB）。
  - Electron 官方文档证实：`app.getPath` 失败仅在路径名非法时抛出，**无** ready 事件前置限制；须 ready 的 API 清单（getLocale 等）不含 getPath。
  - 审计 §7 引用的 `console.warn` 行号、tray 前缀缺失、log.module 前缀缺失在当前代码中均已不存在（疑为审计基于旧提交）。
- **优先级**：D1/D2（P0，防闪退与打爆）→ D5/D6（P1，保留存与恢复）→ D3/D4/D7/D8/D9（P2，规范化）。但 D3/D4 与 D2 同属 IPC 入口硬化，建议同一 PR 交付以免契约改动分裂。
- **风险点**：D5 的清理规则同步是本 spec 最容易做错的地方——只改归档命名不改清理匹配，等于把"留不住历史"换成"清不掉历史"；评审时两处必须成对出现。
- 验收用例随实施新增至 `e2e/logging.spec.ts`（暂名），沿用既有 AC 编号风格。
