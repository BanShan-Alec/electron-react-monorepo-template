import type { SystemInfo } from '@shared/types/system';
import { App } from 'antd';
import { useEffect } from 'react';
import { useManualRequest } from '@/hooks/useManualRequest';

// 私有常量
interface PingMeasurement {
  latency: number;
  serverTime: string;
}

// 可抽离的逻辑处理函数/组件
async function pingWithLatency(): Promise<PingMeasurement> {
  const start = performance.now();
  const res = await window.api.system.ping();
  const latency = Math.round((performance.now() - start) * 10) / 10;
  if (!res.success) {
    throw new Error(res.error);
  }
  return { latency, serverTime: res.data.serverTime };
}

export function useSystemInfo() {
  const { message } = App.useApp();

  // 网络IO（显式挂载触发）—— 系统信息挂载拉取 + 手动刷新
  const {
    data: systemInfo,
    loading: isFetchingInfo,
    refresh: fetchSystemInfo,
    run: fetchSystemInfoRun,
  } = useManualRequest(
    async () => {
      const res = await window.api.system.getSystemInfo();
      if (!res.success) {
        throw new Error(res.error);
      }
      return res.data as SystemInfo;
    },
    {
      onError: (err) => {
        message.error(`获取系统信息失败: ${err.message}`);
      },
    },
  );

  // 显式挂载触发：初次拉取系统信息（run 引用稳定，不会自触循环）
  useEffect(() => {
    fetchSystemInfoRun();
  }, [fetchSystemInfoRun]);

  // 网络IO（显式挂载触发）—— Ping 测量（挂载即测，refresh 驱动手动重测；过期响应自动丢弃）
  const {
    data: ping,
    loading: isPinging,
    refresh: handlePing,
    run: pingRun,
  } = useManualRequest(pingWithLatency, {
    onError: (err) => {
      message.error(`Ping 失败: ${err.message}`);
    },
  });

  // 显式挂载触发：挂载即测一次（run 引用稳定，不会自触循环）
  useEffect(() => {
    pingRun();
  }, [pingRun]);

  return {
    systemInfo: systemInfo ?? null,
    isFetchingInfo,
    fetchSystemInfo,
    pingLatency: ping?.latency ?? null,
    serverTime: ping?.serverTime ?? '',
    isPinging,
    handlePing,
  };
}
