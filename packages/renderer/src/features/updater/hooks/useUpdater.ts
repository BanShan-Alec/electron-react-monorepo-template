import type { UpdaterSnapshot } from '@shared/types/updater';
import { useCallback, useEffect, useState } from 'react';
import { callIpc } from '@/lib/ipc';

const INITIAL_SNAPSHOT: UpdaterSnapshot = {
  state: 'idle',
  progress: null,
  error: null,
  code: null,
};

export function useUpdater() {
  const [snapshot, setSnapshot] = useState<UpdaterSnapshot>(INITIAL_SNAPSHOT);

  const handleCheck = useCallback(async () => {
    try {
      const data = await callIpc('updater:check', window.api.updater.check, []);
      setSnapshot(data);
    } catch {
      // 失败行已由 callIpc 落盘；错误快照经 updater:event:state 推送展示，无需重复处理
    }
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      const data = await callIpc('updater:download', window.api.updater.download, []);
      setSnapshot(data);
    } catch {
      // 同上
    }
  }, []);

  const handleCancel = useCallback(async () => {
    try {
      const data = await callIpc('updater:cancel', window.api.updater.cancel, []);
      setSnapshot(data);
    } catch {
      // 同上
    }
  }, []);

  const handleInstall = useCallback(async () => {
    try {
      await callIpc('updater:install', window.api.updater.install, []);
    } catch {
      // 同上
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await callIpc('updater:close-window', window.api.updater.closeWindow, []);
    } catch {
      // 同上
    }
  }, []);

  useEffect(() => {
    // 挂载初次拉取快照；检查入口内聚在窗口：开窗即查（checking/downloading 进行中则直接吃后续推送）
    const bootstrap = async () => {
      let current: UpdaterSnapshot;
      try {
        current = await callIpc('updater:get-state', window.api.updater.getState, []);
      } catch {
        return;
      }
      setSnapshot(current);
      if (current.state !== 'checking' && current.state !== 'downloading') {
        await handleCheck();
      }
    };
    void bootstrap();

    // 状态流转订阅
    const unsubState = window.api?.updater?.onStateChanged?.((newSnapshot) => {
      setSnapshot(newSnapshot);
    });

    // 下载进度流式订阅
    const unsubProgress = window.api?.updater?.onProgressChanged?.((progress) => {
      setSnapshot((prev) => ({
        ...prev,
        state: 'downloading',
        progress,
      }));
    });

    return () => {
      unsubState?.();
      unsubProgress?.();
    };
  }, [handleCheck]);

  // 「UI 有错 ⇒ 渲染日志必有行」：错误经事件推送/初始快照到达（非 invoke 失败）时
  // 调用失败行不存在，此处补呈现行；同态重复推送不重复记
  useEffect(() => {
    if (snapshot.state === 'error') {
      logger.warn('[updater] Error state presented:', snapshot.code, snapshot.error);
    }
  }, [snapshot.state, snapshot.code, snapshot.error]);

  const handleRetry = useCallback(async () => {
    if (snapshot.version) {
      await handleDownload();
    } else {
      await handleCheck();
    }
  }, [snapshot.version, handleDownload, handleCheck]);

  return {
    snapshot,
    handleCheck,
    handleDownload,
    handleCancel,
    handleInstall,
    handleClose,
    handleRetry,
  };
}
