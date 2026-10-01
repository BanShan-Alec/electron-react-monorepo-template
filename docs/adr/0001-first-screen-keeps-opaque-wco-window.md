# 首屏窗口保持不透明与 WCO 标题栏，不引入 backgroundMaterial

Status: accepted（2026-10-01）

首屏加载方案（[spec](../../specs/first-screen-loading.md)）的蓝图逆向自 ZCode 上游，原期望 Win11 亚克力透明材质；但核实开源源码（v3.14.3）后发现：上游是对 win32 **无条件**应用 `backgroundMaterial: 'acrylic'` 并**自绘**窗口控制按钮，而 Electron 官方文档明确 `backgroundMaterial` 仅支持 Windows 11 22H2（Build ≥ 22621），且 WCO（`titleBarOverlay`）不支持透明 overlay 色（[electron#48193](https://github.com/electron/electron/issues/48193)、[#39959](https://github.com/electron/electron/issues/39959)）。本仓的标题栏体系（`titlebar-overlay.ts` 单一事实源 + `env(titlebar-area-*)` 避让 + 既有 e2e）完全建立在 WCO 之上，改走上游自绘等于整体废弃并引入窗口控制 IPC、最大化状态同步等大范围改造。据此裁决：**首屏窗口保持不透明，`backgroundColor` 复用主题色（`#141414`/`#ffffff`，与 overlay 同源），启动壳浮于实体底色之上；不引入 `backgroundMaterial`/`transparent`/`vibrancy`。**

## Considered Options

- **A. 保 WCO 叠加 acrylic**：overlay 色带不支持透明，顶栏会出现实色条破坏沉浸感，且 hover 异常缺陷风险（#48193）——否决；
- **B. 跟随上游自绘窗控**：视觉最纯正，但范围爆炸（按钮组件 + 桌面命令 IPC + 最大化状态同步 + e2e 改造），溢出首屏加载边界——否决；
- **C. 保持不透明 + 主题底色（选定）**：范围最收敛，首屏链路（壳/双门禁/交叉淡入）完整保留，仅材质档次降级。

## Consequences

- 首屏视觉为"实体底色 + 深色卡片壳"，非亚克力沉浸效果；各 Windows 版本行为一致，无版本分支；
- 未来若引入 acrylic：门禁阈值必须为 **22621**（早期方案推演中采用的 22000 有误，Win11 21H2 22000–22620 不支持该 API），且需先解决 overlay 色带问题或转向自绘窗控。
