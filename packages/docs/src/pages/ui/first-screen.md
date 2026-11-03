---
title: 首屏体验（Startup-orchestration）
description: 动画、React 首帧与主进程就绪三路门禁协调揭幕，内联启动壳顶住白屏空窗期。
---

# 首屏体验（Startup-orchestration）

> **TL;DR**：React 挂载前由轻量内联 HTML 启动壳顶住白屏；构建内联的启动协调器（Coordinator）等待 Logo 动画、React 首帧与主进程就绪三路门禁齐备后交叉揭幕，任一路失联均有超时兜底。

## 1. 选型理由

桌面应用从双击图标到首屏完全可交互，中间面临三重不确定性：
1. **白屏闪烁**：Chromium 渲染进程解析庞大 JS 产物时页面空白。
2. **时序割裂**：前端 React 已经渲染完成，但主进程的核心控制器或配置存储尚未就绪，导致用户点击触发空指针。
3. **死锁风险**：若强依赖某单一路就绪信号，一旦发生异常（如主进程 IPC 假死），应用将永久卡在 Loading 骨架屏。

传统社区实践常采用 `show: false` 配合 `ready-to-show` 事件再呈现窗口，但这会导致用户双击桌面图标后在数百毫秒内没有任何物理界面出现，产生严重的“假死未启动”迟滞感。本项目刻意采用**「窗口创建即显示 + 底色对齐 + 裸 DOM 启动壳即刻呈现」**，在首帧瞬间给用户即时视觉反馈，再由启动协调器进行三道门禁汇流与超时兜底。

## 2. 核心配置代码

### 三路就绪门禁与揭幕逻辑

协调器作为构建期插件直接内联至 `index.html`，先于 React 执行：

→ 源码：[packages/renderer/src/startup/coordinator.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/startup/coordinator.ts)

```ts
type GateId = 'animation' | 'react' | 'main';

let finished = false;
const pendingGates = new Set<GateId>(['animation', 'react', 'main']);

const tryFinishStartup = () => {
  if (finished || pendingGates.size > 0) return;
  finished = true;
  // 揭幕：向 body 挂载就绪标志，触发 CSS 交叉淡入动画
  document.body.classList.add(APP_STARTUP_READY_CLASS);
  window.setTimeout(
    () => document.getElementById(LOADING_ELEMENT_ID)?.remove(),
    STARTUP_UNMOUNT_DELAY_MS,
  );
};

const settleGate = (id: GateId) => {
  if (finished) return;
  pendingGates.delete(id);
  tryFinishStartup();
};
```

### 主进程就绪「先拉后推」双通道防漏

主进程模块就绪信号可能在渲染层监听器挂载前就已发出。协调器在执行首期通过预拉取快照，晚到信号再由事件补推：

```ts
const bridge = window.api?.startup;
if (!bridge) {
  settleGate('main'); // 无 Bridge 环境（如纯浏览器调试）不阻塞揭幕
} else {
  // 1. 先查快照（若主进程已就绪直接放行）
  bridge.getSnapshot().then((s) => { if (s.mainReady) settleGate('main'); });
  // 2. 监听补推
  window.addEventListener(APP_STARTUP_MAIN_READY_EVENT, () => settleGate('main'), { once: true });
  // 3. 超时兜底（5 秒）
  window.setTimeout(() => settleGate('main'), STARTUP_MAIN_FALLBACK_MS);
}
```

## 3. 桌面端避坑注意事项

- **首屏协调器与 CSP 生产策略协同**：
  - 启动协调器是构建期直接内联到 `index.html` 的独立原生脚本。主进程在配置生产态 CSP 时，`script-src` 必须包含 `'unsafe-inline'`（或匹配 hash），否则协调器会被 Chromium 静默阻断，导致三门禁永远无法结算揭幕，造成应用与自动化测试无死锁假死。
- **产物冒烟严禁断言静态 `#root` 假阳性**：
  - 许多冒烟测试仅断言 HTML 包含 `<div id="root">` 便判定渲染成功，此时页面可能因 JS 语法错误处于彻底白屏。产物校验脚本必须等待 `page.waitForSelector('body.app-startup-ready')`，断言协调器真实完成揭幕。
- **三门禁超时兜底单一真源**：
  - `STARTUP_ANIMATION_FALLBACK_MS`（1s）、`STARTUP_REACT_FALLBACK_MS`（3s）、`STARTUP_MAIN_FALLBACK_MS`（5s）常量统一定义在 `@app/shared`，严禁在渲染端与主进程分别硬编码数字。
- **裸 DOM 启动壳样式不引外部资源**：
  - 启动壳 CSS 必须直接内联在 HTML `<style>` 标签中，严禁引用外部字体或外链图片，确保在最慢的物理磁盘上也能在首帧瞬间呈现。
