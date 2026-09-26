import type { PerformActionInput } from '@shared/schemas/diagnostics';
import { App } from 'antd';
import { useState } from 'react';
import { useManualRequest } from '@/hooks/useManualRequest';
import { callIpc } from '@/lib/ipc';

// 私有常量
type LogLevel = 'info' | 'warn' | 'error';
type DiagnosticsAction = 'log' | 'openLogFolder';
type DevToolsAction = 'toggleDevTools' | 'openUrl';

// 可抽离的逻辑处理函数/组件

export function useDiagnostics() {
  const { message } = App.useApp();
  const [logStatus, setLogStatus] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<string>('');

  // 网络IO（显式触发）—— 日志动作通道（单一 loading，过期响应自动丢弃）
  const { runAsync: runLogAction, loading: isLoading } = useManualRequest(
    async (action: { kind: DiagnosticsAction; level: LogLevel }) => {
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

  // 网络IO（显式触发）—— DevTools / 外链动作通道
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
      return data.message;
    },
    {
      onSuccess: (msg) => {
        setActionMessage(msg);
      },
      onError: (err) => {
        message.error(`操作失败: ${err.message}`);
      },
    },
  );

  // 逻辑处理函数
  const runGuarded = async (runner: () => Promise<void>) => {
    try {
      await runner();
    } catch {
      // 过期响应 CancelledError 已丢弃；业务异常已由 onError 提示，此处防止未处理拒绝
    }
  };

  const handleSendLog = (level: LogLevel) =>
    void runGuarded(() => runLogAction({ kind: 'log', level }).then(() => undefined));
  const handleOpenLogFolder = () =>
    void runGuarded(() =>
      runLogAction({ kind: 'openLogFolder', level: 'info' }).then(() => undefined),
    );
  const handleToggleDevTools = () =>
    void runGuarded(() => runDevToolsAction({ kind: 'toggleDevTools' }).then(() => undefined));
  const handleOpenDocs = () =>
    void runGuarded(() => runDevToolsAction({ kind: 'openUrl' }).then(() => undefined));

  return {
    logStatus,
    actionMessage,
    isLoading,
    handleSendLog,
    handleOpenLogFolder,
    handleToggleDevTools,
    handleOpenDocs,
  };
}
