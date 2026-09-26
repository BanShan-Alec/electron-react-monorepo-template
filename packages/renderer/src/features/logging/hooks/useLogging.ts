import { App } from 'antd';
import { useState } from 'react';
import { useManualRequest } from '@/hooks/useManualRequest';
import { callIpc } from '@/lib/ipc';

// 私有常量
type LogLevel = 'info' | 'warn' | 'error';
type LoggingAction = 'log' | 'openLogFolder';

// 可抽离的逻辑处理函数/组件

/**
 * 日志域：发送日志到主进程、打开日志目录（过期响应自动丢弃，单一 loading）。
 */
export function useLogging() {
  const { message } = App.useApp();
  const [logStatus, setLogStatus] = useState<string>('');

  // 网络IO（显式触发）—— 单一动作通道
  const { runAsync: runLogAction, loading: isLoading } = useManualRequest(
    async (action: { kind: LoggingAction; level: LogLevel }) => {
      if (action.kind === 'log') {
        await callIpc('diagnostics.log', window.api.diagnostics.log, [
          {
            level: action.level,
            message: `测试 ${action.level.toUpperCase()} 日志沉淀来自 Renderer`,
            meta: { timestamp: Date.now() },
          },
        ]);
        return `✅ 已发送 ${action.level.toUpperCase()} 日志到 renderer.log`;
      }
      const data = await callIpc(
        'diagnostics.openLogFolder',
        window.api.diagnostics.openLogFolder,
        [],
      );
      return `📂 已打开日志目录: ${data.path}`;
    },
    {
      onSuccess: (status) => {
        setLogStatus(status);
      },
      onError: (err) => {
        message.error(`日志操作失败: ${err.message}`);
      },
    },
  );

  // 逻辑处理函数
  const handleSendLog = (level: LogLevel) => {
    void runLogAction({ kind: 'log', level }).catch(() => {
      // 过期响应 CancelledError 已丢弃；业务异常已由 onError 提示，此处防止未处理拒绝
    });
  };

  const handleOpenLogFolder = () => {
    void runLogAction({ kind: 'openLogFolder', level: 'info' }).catch(() => {});
  };

  return {
    logStatus,
    isLoading,
    handleSendLog,
    handleOpenLogFolder,
  };
}
