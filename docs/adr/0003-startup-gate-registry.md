# 就绪门禁注册表与主进程单向推送（壳期 IPC 边界修订）

Status: accepted（2026-10-05）

首屏加载规范 v1 的就绪协调器是硬编码双门禁（壳动画 + React 首帧），且 §6.3 红线禁止壳期 IPC。用户需求：壳的就绪判定要为"主进程的耗时数据"留拓展性（D9）。裁决分两层：

**一、协调器演进为门禁注册表**：`pendingGates` 集合 + 每门禁"信号 / 拉取 / 兜底超时"三路径 settle，全部齐备才交叉淡入。新增就绪源 = 一个集合成员 + 一段注册代码 + 一个兜底常量，零结构改动。首个新增源为主进程就绪 `app-startup-main-ready`（ModuleRunner 链初始化完成即闩锁，payload 携带 `initMs`/`latchedAt`）。

**二、§6.3"禁壳期 IPC"修订为"壳期 IPC 边界"**：禁止的是**壳显形依赖主进程往返应答**的同步耦合；允许**引导期一次性快照拉取**（`startup:get-snapshot`）与**单向订阅推送**（`startup:event:main-ready`），事件源必须闩锁（先到信号经拉取补发）。就绪判定仍以渲染端闭环为骨架（事件 + 兜底超时），主进程信号迟到/缺席时壳永不被卡死（主门禁兜底 5000ms）。

主进程信号必然早于窗口创建（链位在 WindowManager 之前），因此"纯事件推送"存在先于监听器注册的丢信号窗口。落地形态：preload 求值时（早于页面一切脚本）`invoke` 一次快照 + 订阅增量；壳协调器注册门禁时先 `getSnapshot()` 拉取（常态直接命中闩锁）、再听跨世界 DOM 事件、最后 5s 兜底。contextIsolation 下 preload 直接写 `window.xxx` 对主世界不可见，故快照载体为 contextBridge API，跨世界只派发无 payload 纯 `Event`（payload 经回调携带）——详见 [spec §10.7](../../specs/first-screen-loading.md)。

## Considered Options

- **A. 维持双门禁 + 保持禁 IPC**：范围最小，但拓展性停在纸面，首个真实就绪源要重新踩闩锁/丢信号的坑——否决；
- **B. 门禁注册表 + 纯事件推送（主进程 did-finish-load 重发）**：少一次 invoke，但存在监听器挂上前的事件丢失窗口，依赖重发时机，脆——否决；
- **C. 门禁注册表 + 先拉后推（闩锁快照 + 订阅推送，选定）**：电平 + 边沿双形态，丢信号问题结构性消除；复用本仓 `config.get()/onChanged` 先例，管道（shared 契约 → main → preload → 壳）被 e2e 真实验证（AC-7）；
- **D. 三段式视觉链中段（上游 RootStartupLoading 模式）**：为未来主进程重型初始化准备的 UI 层方案，当前无消费者（D2 维持不做），本 ADR 的注册表即其接入缝。

## Consequences

- shared 新增 `constants/startup.ts`（4 个契约常量）与 `types/startup.ts`（payload/快照类型）、`ipc-channels.ts` 增补 2 通道；v1"两端字符串耦合"技术债消除；
- main 新增 `startup-readiness.module.ts`（闩锁 + handle + broadcast，链位 IPC 之后、WindowManager 之前），preload `apiBridge` 新增 `startup` 命名空间；
- 修订后的 §6.3 是壳期 IPC 的持久边界：任何"壳等主进程应答才能显形"的新逻辑都违规；新增就绪源必须闩锁并给出兜底超时；
- e2e 新增 AC-7（快照已闩锁且 `initMs` 为正）——管道回归从此有自动守护。
