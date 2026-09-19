import { useState } from 'react';

export function useDiagnostics() {
  const [logStatus, setLogStatus] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendLog = async (level: 'info' | 'warn' | 'error') => {
    setIsLoading(true);
    try {
      const res = await window.api.diagnostics.log({
        level,
        message: `测试 ${level.toUpperCase()} 日志沉淀来自 Renderer`,
        meta: { timestamp: Date.now() },
      });
      if (res.success) {
        setLogStatus(`✅ 已发送 ${level.toUpperCase()} 日志到 renderer.log`);
      } else {
        setLogStatus(`❌ 发送日志失败: ${res.error}`);
      }
    } catch (err) {
      setLogStatus(`❌ 发送日志失败: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenLogFolder = async () => {
    setIsLoading(true);
    try {
      const res = await window.api.diagnostics.openLogFolder();
      if (res.success) {
        setLogStatus(`📂 已打开日志目录: ${res.data.path}`);
      } else {
        setLogStatus(`打开目录失败: ${res.error}`);
      }
    } catch (err) {
      setLogStatus(`打开目录失败: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDevTools = async () => {
    try {
      const res = await window.api.diagnostics.performAction({ action: 'toggleDevTools' });
      if (res.success) {
        setActionMessage(res.data.message);
      } else {
        setActionMessage(`Error: ${res.error}`);
      }
    } catch (err: unknown) {
      setActionMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleOpenDocs = async () => {
    try {
      const res = await window.api.diagnostics.performAction({
        action: 'openUrl',
        url: 'https://github.com',
      });
      if (res.success) {
        setActionMessage(res.data.message);
      } else {
        setActionMessage(`Error: ${res.error}`);
      }
    } catch (err: unknown) {
      setActionMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

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
