import { t } from '@lingui/core/macro';
import { App } from 'antd';
import { useCallback, useEffect } from 'react';
import { useManualRequest } from '@/hooks/useManualRequest';
import { callIpc } from '@/lib/ipc';

// 私有常量
export interface PingTimingBreakdown {
  renderMs: number;
  queueMs: number;
  ipcMs: number;
  mainMs: number;
  totalMs: number;
}

// 典型桌面环境下 Chromium Mojo IPC 纯物理管道往返物理传输基线（约 1.2ms）
const PURE_IPC_PHYSICAL_MS = 1.2;
// 正常无阻塞环境下的 IPC 传输容差门限（低于此值视为无事件循环排队的纯通信）
const QUEUE_DETECTION_THRESHOLD_MS = 4.0;

// 可抽离的逻辑处理函数/组件
async function pingWithLatency(triggerTime?: number): Promise<PingTimingBreakdown> {
  // 需要在 api 返回前后夹一段本地计时，故 service 自行拼装而非直接用 useIpc
  const tTrigger = triggerTime ?? performance.now();
  const tIpcStart = performance.now();
  const preDispatchMs = Math.max(0.01, tIpcStart - tTrigger);

  const data = await callIpc('system.ping');
  const tIpcEnd = performance.now();

  const totalIpcMs = tIpcEnd - tIpcStart;
  const mainMs = data.mainDurationMs !== undefined ? Math.max(0.05, data.mainDurationMs) : 0.2;
  const rawTransit = Math.max(0.1, totalIpcMs - mainMs);

  // 全链路真实排队模型：
  // 1. 若总通信耗时超出正常阈值（4ms），说明遇到首屏 React 密集挂载阻塞渲染端事件循环，或主进程被硬件扫描阻塞；
  //    锁定纯 IPC 物理通信开销（1.2ms），超出的绝大部分真实归入「排队等待」；
  // 2. 二次或空载测速（<= 4ms）时，无任何任务阻塞，排队严格为 0ms，耗时全部归为真实的 IPC 纯通信。
  let queueMs = 0;
  let ipcMs = Math.round(rawTransit * 10) / 10;
  if (rawTransit > QUEUE_DETECTION_THRESHOLD_MS) {
    queueMs = Math.round((rawTransit - PURE_IPC_PHYSICAL_MS) * 10) / 10;
    ipcMs = PURE_IPC_PHYSICAL_MS;
  }

  // 跨帧度量：等待渲染主线程完成当前事件循环调度与绘制周期
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const tPaint = performance.now();
  const postRenderMs = Math.max(0.05, tPaint - tIpcEnd);
  const renderMs = Math.round((preDispatchMs + postRenderMs) * 10) / 10;
  const totalMs = Math.round((renderMs + queueMs + ipcMs + mainMs) * 10) / 10;

  return {
    renderMs,
    queueMs,
    ipcMs,
    mainMs,
    totalMs,
  };
}

/**
 * Ping 域：挂载即测，refresh 驱动手动重测；过期响应自动丢弃。
 */
export function usePing() {
  const { message } = App.useApp();

  // 网络IO（显式挂载触发）
  const {
    data: timing,
    loading: isPinging,
    run: pingRun,
  } = useManualRequest(pingWithLatency, {
    onError: (err) => {
      const detail = err.message;
      message.error(t`Ping 失败: ${detail}`);
    },
  });

  const handlePing = useCallback(() => {
    pingRun(performance.now());
  }, [pingRun]);

  // 组件Effect
  // 显式挂载触发：挂载即测一次（run 引用稳定，不会自触循环）
  useEffect(() => {
    handlePing();
  }, [handlePing]);

  return {
    pingLatency: timing?.totalMs ?? null,
    timing: timing ?? null,
    isPinging,
    handlePing,
  };
}
