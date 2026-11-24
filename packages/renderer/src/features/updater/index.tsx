import type React from 'react';
import { AppInfoHeader } from './components/AppInfoHeader';
import { ChangelogCard } from './components/ChangelogCard';
import { ProgressCard } from './components/ProgressCard';
import { StatusSection } from './components/StatusSection';
import { UpdaterFooter } from './components/UpdaterFooter';
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
      {/* 应用信息区：静音底 + 图标 + 版本 + 元数据 + 资源链接，兼作窗口拖拽区（单一真源 APP_INFO） */}
      <AppInfoHeader currentVersion={snapshot.currentVersion} onClose={handleClose} />

      {/* 主体内容区域：应用更新小节（标签 + 状态行 + 提示）+ 变更日志 + 下载进度 */}
      <div className="min-h-0 flex-1 flex flex-col gap-4 overflow-y-auto px-6 py-5">
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

        {showChangelog && (
          <ChangelogCard
            version={snapshot.version}
            releaseDate={snapshot.releaseDate}
            releaseNotes={snapshot.releaseNotes}
          />
        )}

        {showsProgress(snapshot) && <ProgressCard progress={snapshot.progress} />}
      </div>

      {/* 底部动作区：自动检查偏好 + 关闭 */}
      <UpdaterFooter autoCheck={autoCheck} onClose={handleClose} />
    </div>
  );
};

export default UpdaterFeature;
