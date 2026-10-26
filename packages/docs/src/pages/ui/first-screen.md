# 首屏体验（Startup-orchestration）

> **TL;DR**：动画、React 首帧、主进程就绪三路门禁，齐备才揭幕。

用户从双击图标到看见可用界面，中间隔着三段等待：Logo 动画、React 首帧、主进程就绪。启动编排的策略是三者齐备才揭幕，任何一路失联则由兜底放行。

→ 源码：[packages/renderer/src/startup/coordinator.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/startup/coordinator.ts)

## 白屏期：裸 DOM 启动壳先顶上

React 挂载前的空窗期，用一个裸 DOM 启动壳顶住：`#root` 透明度 0，`#loading` 层放 Logo 弹出动画，所有就绪源齐备才交叉淡入。协调器是构建期内联进 index.html 的经典 IIFE（[packages/renderer/plugins/startup-shell.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/plugins/startup-shell.ts) 程序化打包），物理位置先于 `main.tsx` 执行，不依赖任何框架。

## 揭幕条件：动画、首帧、主进程三路齐备

门禁注册表：三个就绪源各占一个 `GateId`，全部 settle 才揭幕——

```ts
type GateId = 'animation' | 'react' | 'main';

let finished = false;
const pendingGates = new Set<GateId>(['animation', 'react', 'main']);

const tryFinishStartup = () => {
  if (finished || pendingGates.size > 0) return;
  finished = true;
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

## 任何一路失联，兜底放行

三个门禁各自独立兜底，任一就绪源失联都不会永久卡死壳：

→ 源码：[packages/shared/src/constants/startup.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/shared/src/constants/startup.ts)

```ts
export const STARTUP_ANIMATION_FALLBACK_MS = 1000;
export const STARTUP_REACT_FALLBACK_MS = 3000;
export const STARTUP_MAIN_FALLBACK_MS = 5000;
```

## 主进程就绪：先拉后推，信号不丢

主进程门禁是「先拉后推」双通道——主进程就绪信号可能早于壳监听器注册（信号丢了都没人听见），所以 preload 求值时即预取快照，晚到的信号再经事件推送补发：

```ts
const bridge = (window as { api?: { startup?: StartupBridgeLike } }).api?.startup;
if (!bridge) {
  settleGate('main'); // 无 preload 桥的异常环境不阻塞壳
} else {
  bridge
    .getSnapshot()
    .then((snapshot) => {
      if (snapshot.mainReady) settleGate('main');
    })
    .catch(() => {}); // 拉取失败交给事件与兜底路径
  window.addEventListener(APP_STARTUP_MAIN_READY_EVENT, () => settleGate('main'), { once: true });
  window.setTimeout(() => settleGate('main'), STARTUP_MAIN_FALLBACK_MS);
}
```

## 主进程闩锁与 React 首帧通知

主进程侧的就绪源是一个纯闩锁模块（→ 源码：[packages/main/src/modules/startup-readiness.module.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/main/src/modules/startup-readiness.module.ts)）：`enable()` 置位快照并广播，payload 顺带携带初始化耗时。React 首帧由通知器派发：

→ 源码：[packages/renderer/src/components/startup/StartupReadyNotifier/index.tsx](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/components/startup/StartupReadyNotifier/index.tsx)

```ts
useEffect(() => {
  window[APP_REACT_COMMIT_AT_KEY] = Date.now();
  performance.mark('app:react-commit');
  window.dispatchEvent(new Event(APP_REACT_STARTUP_READY_EVENT));
}, []);
```

## 新增一个就绪源

新增一个就绪源 = 加一个 `GateId` + 一段注册代码 + 一个兜底常量，常量四端共用（shared 单一事实源），改名跨端同步有据可查。
