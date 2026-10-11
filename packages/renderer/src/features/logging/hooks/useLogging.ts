import { t } from '@lingui/core/macro';
import { App } from 'antd';
import { useState } from 'react';
import { useManualRequest } from '@/hooks/useManualRequest';
import { callIpc } from '@/lib/ipc';

import { Sentry } from '@/lib/sentry';

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
      const levelUpper = action.level.toUpperCase();
      if (action.kind === 'log') {
        await callIpc('diagnostics.log', window.api.diagnostics.log, [
          {
            level: action.level,
            message: `Test ${levelUpper} log emitted from Renderer`,
            meta: { timestamp: Date.now() },
          },
        ]);
        return t`✅ 已发送 ${levelUpper} 日志到 renderer.log`;
      }
      const data = await callIpc(
        'diagnostics.openLogFolder',
        window.api.diagnostics.openLogFolder,
        [],
      );
      return t`📂 已打开日志目录: ${data.path}`;
    },
    {
      onSuccess: (status) => {
        setLogStatus(status);
      },
      onError: (err) => {
        message.error(t`日志操作失败: ${err.message}`);
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

  const handleTriggerSentryError = () => {
    const errorMsg = 'Test Sentry exception triggered from UI';
    const err = new Error(errorMsg);

    // 1. 记录本地落盘日志到 renderer.log
    void callIpc('diagnostics.log', window.api.diagnostics.log, [
      {
        level: 'error',
        message: errorMsg,
        meta: { triggeredFrom: 'UI', timestamp: Date.now() },
      },
    ]).catch(() => {});

    // 2. 尝试调用 Sentry 捕获上报
    let sentryEventId: string | undefined;
    try {
      if (Sentry.getClient()) {
        sentryEventId = Sentry.captureException(err);
      }
    } catch {
      // 容错处理
    }

    // 3. 及时更新 UI 状态展示与用户反馈
    if (sentryEventId) {
      setLogStatus(t`❌ 已触发异常并上报 Sentry (ID: ${sentryEventId})，已写入 renderer.log`);
      message.success(t`已上报异常到 Sentry (ID: ${sentryEventId})`);
    } else {
      setLogStatus(t`⚠️ 已触发异常并写入 renderer.log (Sentry 未激活或未配置有效 DSN)`);
      message.warning(t`Sentry 未激活，已将异常记录至本地日志`);
    }

    // 4. 异步抛出异常至全局执行栈，供 window.onerror 全局监听器捕获并在 DevTools 呈现
    setTimeout(() => {
      throw err;
    }, 0);
  };

  return {
    logStatus,
    isLoading,
    handleSendLog,
    handleOpenLogFolder,
    handleTriggerSentryError,
  };
}
