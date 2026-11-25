import type React from 'react';
import { AppInfoHeader } from './components/AppInfoHeader';
import { ChangelogCard } from './components/ChangelogCard';
import { HeaderActions } from './components/HeaderActions';
import { ProgressCard } from './components/ProgressCard';
import { StatusSection } from './components/StatusSection';
import { useAutoCheckSetting } from './hooks/useAutoCheckSetting';
import { useUpdater } from './hooks/useUpdater';
import { showsChangelog, showsProgress } from './status-mapping';

export const UpdaterFeature: React.FC = () => {
  const {
    snapshot,
    handleCheck,
    handleDownload,
    handleCancel,
    handleInstall,
    handleClose,
    handleRetry,
  } = useUpdater();
  const autoCheck = useAutoCheckSetting();

  // 卡片可见性统一由状态映射层裁定（新增状态只改 status-mapping 一处）
  const showChangelog = showsChangelog(snapshot);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground select-none overflow-hidden border border-border">
      {/* 应用信息区：静音底 + 图标 + 版本 + 元数据 + 资源链接，兼作窗口拖拽区（单一真源 APP_INFO）；
          右上角悬浮「更多（偏好）+ 关闭」，底栏已移除（偏好挪进更多菜单） */}
      <div className="relative shrink-0">
        <AppInfoHeader currentVersion={snapshot.currentVersion} />
        <HeaderActions
          autoCheck={autoCheck}
          isDownloading={snapshot.state === 'downloading'}
          onClose={handleClose}
        />
      </div>

      {/* 主体内容区域：应用更新小节（标签 + 状态行 + 提示）→ 下载进度 → 变更日志
          进度卡必须排在日志卡之前：下载中进度是首要信息，排在长日志后面会被挤出首屏 */}
      <div className="min-h-0 flex-1 flex flex-col gap-5 overflow-y-auto px-6 py-5">
        <StatusSection
          snapshot={snapshot}
          handlers={{
            check: handleCheck,
            download: handleDownload,
            cancel: handleCancel,
            install: handleInstall,
            retry: handleRetry,
          }}
        />

        {showsProgress(snapshot) && <ProgressCard progress={snapshot.progress} />}

        {showChangelog && (
          <ChangelogCard
            version={snapshot.version}
            releaseDate={snapshot.releaseDate}
            releaseNotes={snapshot.releaseNotes}
          />
        )}
      </div>
    </div>
  );
};

export default UpdaterFeature;
