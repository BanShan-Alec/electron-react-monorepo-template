import { App } from 'antd';
import { useEffect } from 'react';
import { useIpc } from '@/hooks/useIpc';
import { useManualRequest } from '@/hooks/useManualRequest';
import { callIpc } from '@/lib/ipc';

// 私有常量
interface PingMeasurement {
  latency: number;
  serverTime: string;
}

// 可抽离的逻辑处理函数/组件
async function pingWithLatency(): Promise<PingMeasurement> {
  // ping 需要在 api 返回前后夹一段本地计时，故 service 自行拼装而非直接用 useIpc
  const start = performance.now();
  const data = await callIpc('system.ping', window.api.system.ping, []);
  const latency = Math.round((performance.now() - start) * 10) / 10;
  return { latency, serverTime: data.serverTime };
}

export function useSystemInfo() {
  const { message } = App.useApp();

  // 网络IO（显式挂载触发）—— 系统信息挂载拉取 + 手动刷新
  // useIpc 从 api 函数签名推导 data 类型，无需手写 Result 解构与类型断言
  const {
    data: systemInfo,
    loading: isFetchingInfo,
    refresh: fetchSystemInfo,
    run: fetchSystemInfoRun,
  } = useIpc('system.getSystemInfo', window.api.system.getSystemInfo, {
    onError: (err) => {
      message.error(`获取系统信息失败: ${err.message}`);
    },
  });

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
