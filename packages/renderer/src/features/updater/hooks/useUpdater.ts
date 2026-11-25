import type { UpdaterSnapshot } from '@shared/types/updater';
import { useEffect, useRef, useState } from 'react';
import { callIpc } from '@/lib/ipc';
import { shouldAutoCheckOnOpen } from '../status-mapping';

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
  const runSnapshotAction = async (
    channel: 'updater.check' | 'updater.download' | 'updater.cancel',
  ) => {
    try {
      const data = await callIpc(channel);
      // 手动动作也纳入 revision 防护：主进程动作内置去重时可能不再推送事件，
      // 此时 bootstrap 的迟到应答不得覆盖用户刚拿到的较新快照
      revisionRef.current += 1;
      latestEventRef.current = data;
      setSnapshot(data);
    } catch {
      // 同上
    }
  };

  const handleCheck = () => runSnapshotAction('updater.check');

  const handleDownload = () => runSnapshotAction('updater.download');

  const handleCancel = () => runSnapshotAction('updater.cancel');

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
      let current: UpdaterSnapshot;
      try {
        current = await callIpc('updater.getState');
      } catch {
        return;
      }
      if (requestId !== requestIdRef.current) return;
      // 判据是「是否收到完整 state 事件」而不是 revision 是否前迸：请求期间可能只来了
      // 进度事件（latestEventRef 仍为 null），此时应答仍是唯一完整快照，必须回写；
      // 否则快照停在 INITIAL idle，进度订阅也会因 prev.state !== 'downloading' 全部丢弃
      const latestState = latestEventRef.current;
      setSnapshot(latestState ?? current);
      const effective = latestState ?? current;
      // 开窗即查仅限「还没有结果」的阶段（其它阶段有结果或正在推进，见 shouldAutoCheckOnOpen）
      if (shouldAutoCheckOnOpen(effective.state)) {
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
      // 只有正在下载时才叠加进度：取消/失败后迟到的进度事件不得把状态拨回 downloading
      setSnapshot((prev) => (prev.state === 'downloading' ? { ...prev, progress } : prev));
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
