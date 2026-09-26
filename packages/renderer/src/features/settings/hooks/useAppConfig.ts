import type { AppConfig } from '@shared/schemas/config';
import { App } from 'antd';
import { useEffect } from 'react';
import { useIpc } from '@/hooks/useIpc';
import { useAppStore } from '@/stores/useAppStore';

// 私有常量

// 可抽离的逻辑处理函数/组件

export function useAppConfig() {
  const { message } = App.useApp();
  const setThemeMode = useAppStore((state) => state.setThemeMode);

  // 网络IO（显式挂载触发）—— 拉取偏好配置
  const {
    data: appConfig,
    loading: isFetching,
    refresh: fetchConfig,
    run: fetchConfigRun,
  } = useIpc('config.get', window.api.config.get, {
    onSuccess: (data) => {
      setThemeMode(data.theme);
    },
    onError: (err) => {
      message.error(`读取偏好设置失败: ${err.message}`);
    },
  });

  // 显式挂载触发：初次拉取（run 引用稳定，不会自触循环）
  useEffect(() => {
    fetchConfigRun();
  }, [fetchConfigRun]);

  // 网络IO（显式触发）—— 局部更新后回填
  const { runAsync: updateConfigAsync } = useIpc('config.update', window.api.config.update, {
    onError: (err) => {
      message.error(`更新偏好设置失败: ${err.message}`);
    },
  });

  // 网络IO（显式触发）—— 恢复默认值后回填
  const { runAsync: resetConfigAsync, loading: isResetting } = useIpc(
    'config.reset',
    window.api.config.reset,
    {
      onSuccess: (data) => {
        setThemeMode(data.theme);
      },
      onError: (err) => {
        message.error(`恢复默认配置失败: ${err.message}`);
      },
    },
  );

  // 逻辑处理函数
  const handleUpdateConfig = async (partial: Partial<AppConfig>) => {
    try {
      await updateConfigAsync(partial);
      if (partial.theme !== undefined) {
        setThemeMode(partial.theme);
      }
      await fetchConfig();
    } catch {
      // 过期响应 CancelledError 与业务异常均已丢弃/提示，此处防止未处理拒绝
    }
  };

  const handleResetConfig = async () => {
    try {
      await resetConfigAsync();
      await fetchConfig();
    } catch {
      // 同上
    }
  };

  return {
    appConfig: appConfig ?? null,
    isLoading: isFetching || isResetting,
    fetchConfig,
    handleUpdateConfig,
    handleResetConfig,
  };
}
