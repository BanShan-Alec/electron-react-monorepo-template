import type { UpdaterSnapshot } from '@shared/types/updater';
import { useEffect, useRef, useState } from 'react';
import { callIpc } from '@/lib/ipc';

const INITIAL_SNAPSHOT: UpdaterSnapshot = {
  state: 'idle',
  progress: null,
  error: null,
  code: null,
};

export function useUpdater() {
  const [snapshot, setSnapshot] = useState<UpdaterSnapshot>(INITIAL_SNAPSHOT);
  // 防竞态双计数：bootstrap 拉取期间到达的推送使 revision 前进，
  // 迟到的 getState 应答因 revision 不一致被丢弃，不会覆盖事件已写入的新状态
  const revisionRef = useRef(0);
  const requestIdRef = useRef(0);
  const latestEventRef = useRef<UpdaterSnapshot | null>(null);

  const applyEvent = (newSnapshot: UpdaterSnapshot) => {
    revisionRef.current += 1;
    latestEventRef.current = newSnapshot;
    setSnapshot(newSnapshot);
  };

  // ⑤ 逻辑处理函数：失败行已由 callIpc 落盘；错误快照经 updater:event:state 推送展示
  const handleCheck = async () => {
    try {
      const data = await callIpc('updater.check');
      setSnapshot(data);
    } catch {
      // 同上
    }
  };

  const handleDownload = async () => {
    try {
      const data = await callIpc('updater.download');
      setSnapshot(data);
    } catch {
      // 同上
    }
  };

  const handleCancel = async () => {
    try {
      const data = await callIpc('updater.cancel');
      setSnapshot(data);
    } catch {
      // 同上
    }
  };

  const handleInstall = async () => {
    try {
      await callIpc('updater.install');
    } catch {
      // 同上
    }
  };

  const handleClose = async () => {
    try {
      await callIpc('updater.closeWindow');
    } catch {
      // 同上
    }
  };

  const handleRetry = async () => {
    if (snapshot.version) {
      await handleDownload();
    } else {
      await handleCheck();
    }
  };

  // ⑥ 组件 Effect
  useEffect(() => {
    // 挂载初次拉取快照；检查入口内聚在窗口：开窗即查（checking/downloading 进行中则直接吃后续推送）
    const requestId = ++requestIdRef.current;

    const bootstrap = async () => {
      const seqBeforeGet = revisionRef.current;
      let current: UpdaterSnapshot;
      try {
        current = await callIpc('updater.getState');
      } catch {
        return;
      }
      if (requestId !== requestIdRef.current) return;
      // 请求期间已有事件到达：事件即最新快照，应答不回写（但事件可能先于订阅，此时应答仍是唯一数据源）
      const hasNewerEvent = revisionRef.current !== seqBeforeGet;
      if (!hasNewerEvent) setSnapshot(current);
      const effective = hasNewerEvent ? (latestEventRef.current ?? current) : current;
      if (effective.state !== 'checking' && effective.state !== 'downloading') {
        try {
          const seqBeforeCheck = revisionRef.current;
          const data = await callIpc('updater.check');
          // check 在主进程内先 emit 后返回：事件落地时 revision 已前迸，跳过重复回写
          if (requestId === requestIdRef.current && revisionRef.current === seqBeforeCheck) {
            setSnapshot(data);
          }
        } catch {
          // 失败行已由 callIpc 落盘；错误快照经 updater:event:state 推送展示
        }
      }
    };
    void bootstrap();

    // 状态流转订阅
    const unsubState = window.api?.updater?.onStateChanged?.(applyEvent);

    // 下载进度流式订阅：进度不是完整快照，仅前迸 revision 并叠加在前一状态上
    const unsubProgress = window.api?.updater?.onProgressChanged?.((progress) => {
      revisionRef.current += 1;
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

  // 「UI 有错 ⇒ 渲染日志必有行」：错误经事件推送/初始快照到达（非 invoke 失败）时
  // 调用失败行不存在，此处补呈现行；同态重复推送不重复记
  useEffect(() => {
    if (snapshot.state === 'error') {
      logger.warn('[updater] Error state presented:', snapshot.code, snapshot.error);
    }
  }, [snapshot.state, snapshot.code, snapshot.error]);

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
