import { t } from '@lingui/core/macro';
import type { PerformActionInput } from '@shared/schemas/diagnostics';
import { App } from 'antd';
import { useState } from 'react';
import { useManualRequest } from '@/hooks/useManualRequest';
import { callIpc } from '@/lib/ipc';

// 私有常量
type DevToolsAction = 'toggleDevTools' | 'openUrl';

// 可抽离的逻辑处理函数/组件

/**
 * 开发者工具域：切换 DevTools、打开外部文档（过期响应自动丢弃）。
 */
export function useDevTools() {
  const { message } = App.useApp();
  const [actionMessage, setActionMessage] = useState<string>('');

  // 网络IO（显式触发）—— 单一动作通道
  const { runAsync: runDevToolsAction } = useManualRequest(
    async (action: { kind: DevToolsAction }) => {
      const input: PerformActionInput =
        action.kind === 'toggleDevTools'
          ? { action: 'toggleDevTools' }
          : { action: 'openUrl', url: 'https://github.com' };
      const data = await callIpc(
        'diagnostics.performAction',
        window.api.diagnostics.performAction,
        [input],
      );
      if (data.message === 'DevTools opened') {
        return t`已开启 DevTools`;
      }
      if (data.message === 'DevTools closed') {
        return t`已关闭 DevTools`;
      }
      if (data.message.startsWith('Opened ')) {
        return t`已在默认浏览器中打开外部页面: https://github.com`;
      }
      return data.message;
    },
    {
      onSuccess: (msg) => {
        setActionMessage(msg);
      },
      onError: (err) => {
        message.error(t`操作失败: ${err.message}`);
      },
    },
  );

  // 逻辑处理函数
  const handleToggleDevTools = () => {
    void runDevToolsAction({ kind: 'toggleDevTools' }).catch(() => {
      // 过期响应 CancelledError 已丢弃；业务异常已由 onError 提示，此处防止未处理拒绝
    });
  };

  const handleOpenDocs = () => {
    void runDevToolsAction({ kind: 'openUrl' }).catch(() => {});
  };

  return {
    actionMessage,
    handleToggleDevTools,
    handleOpenDocs,
  };
}
