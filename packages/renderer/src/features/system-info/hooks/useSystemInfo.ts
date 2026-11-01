import { t } from '@lingui/core/macro';
import { useInterval } from 'ahooks';
import { App } from 'antd';
import { useEffect, useMemo, useRef } from 'react';
import { useIpc } from '@/hooks/useIpc';
import { createIdleRefresh } from '../lib/createIdleRefresh';

// 私有常量

// 可抽离的逻辑处理函数/组件

/**
 * 系统信息域：挂载拉取 + 空闲轮询（过期响应自动丢弃）。
 * useIpc 从 api 函数签名推导 data 类型，无需手写 Result 解构与类型断言。
 */
export function useSystemInfo() {
  const { message } = App.useApp();

  // 网络IO（显式挂载触发）—— 初次拉取与静默成功轮询
  const {
    data: systemInfo,
    loading: isFetchingInfo,
    runAsync: fetchSystemInfoAsync,
  } = useIpc('system.getSystemInfo', window.api.system.getSystemInfo, {
    recordSuccess: false,
    onError: (err) => {
      const detail = err.message;
      message.error(t`获取系统信息失败: ${detail}`);
    },
  });

  // 逻辑处理函数
  const fetchSystemInfoRef = useRef(fetchSystemInfoAsync);
  fetchSystemInfoRef.current = fetchSystemInfoAsync;
  const refreshWhenIdle = useMemo(() => createIdleRefresh(() => fetchSystemInfoRef.current()), []);

  // 组件Effect
  useEffect(() => {
    refreshWhenIdle();
  }, [refreshWhenIdle]);
  useInterval(() => {
    if (!isFetchingInfo) refreshWhenIdle();
  }, 1000);

  return {
    systemInfo: systemInfo ?? null,
    isFetchingInfo,
  };
}
