import type { UpdaterSnapshot } from '@app/shared/types/updater';
import { useCallback, useEffect, useState } from 'react';

const INITIAL_SNAPSHOT: UpdaterSnapshot = {
  state: 'idle',
  progress: null,
  error: null,
};

export function useUpdater() {
  const [snapshot, setSnapshot] = useState<UpdaterSnapshot>(INITIAL_SNAPSHOT);

  useEffect(() => {
    // 挂载初次拉取最新状态快照
    window.api?.updater?.getState?.().then((res) => {
      if (res?.success && res.data) {
        setSnapshot(res.data);
      }
    });

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
  }, []);

  const handleCheck = useCallback(async () => {
    try {
      const res = await window.api.updater.check();
      if (res.success) {
        setSnapshot(res.data);
      }
    } catch (err) {
      console.error('Failed to trigger update check:', err);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      const res = await window.api.updater.download();
      if (res.success) {
        setSnapshot(res.data);
      }
    } catch (err) {
      console.error('Failed to start download:', err);
    }
  }, []);

  const handleCancel = useCallback(async () => {
    try {
      const res = await window.api.updater.cancel();
      if (res.success) {
        setSnapshot(res.data);
      }
    } catch (err) {
      console.error('Failed to cancel download:', err);
    }
  }, []);

  const handleInstall = useCallback(async () => {
    try {
      await window.api.updater.install();
    } catch (err) {
      console.error('Failed to install update:', err);
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await window.api.updater.closeWindow();
    } catch (err) {
      console.error('Failed to close updater window:', err);
    }
  }, []);

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
