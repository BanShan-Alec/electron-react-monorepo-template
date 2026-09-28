import { t } from '@lingui/core/macro';
import { App } from 'antd';
import { useEffect } from 'react';
import { useIpc } from '@/hooks/useIpc';

// 私有常量

// 可抽离的逻辑处理函数/组件

/**
 * 系统信息域：挂载拉取 + 手动刷新（过期响应自动丢弃）。
 * useIpc 从 api 函数签名推导 data 类型，无需手写 Result 解构与类型断言。
 */
export function useSystemInfo() {
  const { message } = App.useApp();

  // 网络IO（显式挂载触发）—— 系统信息挂载拉取 + 手动刷新
  const {
    data: systemInfo,
    loading: isFetchingInfo,
    refresh: fetchSystemInfo,
    run: fetchSystemInfoRun,
  } = useIpc('system.getSystemInfo', window.api.system.getSystemInfo, {
    onError: (err) => {
      message.error(t`获取系统信息失败: ${err.message}`);
    },
  });

  // 组件Effect
  // 显式挂载触发：初次拉取系统信息（run 引用稳定，不会自触循环）
  useEffect(() => {
    fetchSystemInfoRun();
  }, [fetchSystemInfoRun]);

  return {
    systemInfo: systemInfo ?? null,
    isFetchingInfo,
    fetchSystemInfo,
  };
}
