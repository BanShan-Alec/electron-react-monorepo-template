import { CloseOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type React from 'react';
import { EllipsisText } from '@/components/ui/EllipsisText';
import { AppInfoHeader } from './components/AppInfoHeader';
import { ChangelogCard } from './components/ChangelogCard';
import { ProgressCard } from './components/ProgressCard';
import { StatusSection } from './components/StatusSection';
import { UpdaterFooter } from './components/UpdaterFooter';
import { useAutoCheckSetting } from './hooks/useAutoCheckSetting';
import { useUpdater } from './hooks/useUpdater';
import { getStatusHeader, showsChangelog, showsProgress } from './status-mapping';

export const UpdaterFeature: React.FC = () => {
  useLingui();
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

  const { title, subtitle } = getStatusHeader(snapshot);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground select-none overflow-hidden border border-border">
      {/* 标题栏区域：无边框窗口自绘标题栏，通过 no-wco 隔离 WCO 边距，支持拖拽移动窗口 */}
      <div className="drag-region no-wco flex items-center justify-between px-5 py-3.5 border-b border-border bg-background select-none cursor-move shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-base text-primary shrink-0">
            <CloudDownloadOutlined />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground tracking-tight m-0 leading-5">
              <EllipsisText className="block truncate" tooltip={title}>
                {title}
              </EllipsisText>
            </h2>
            <p className="text-xs text-foreground-secondary m-0 mt-0.5 leading-4">
              <EllipsisText className="block truncate" tooltip={subtitle}>
                {subtitle}
              </EllipsisText>
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label={t`关闭`}
          className="no-drag text-foreground-muted hover:text-foreground hover:bg-foreground/10 active:bg-foreground/20 rounded-md w-8 h-8 transition-colors duration-150 inline-flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 shrink-0"
          onClick={handleClose}
        >
          <CloseOutlined className="text-sm" />
        </button>
      </div>

      {/* 应用信息区：图标 + 版本 + 元数据 + 资源链接，单一真源 APP_INFO */}
      <AppInfoHeader currentVersion={snapshot.currentVersion} />

      {/* 主体内容区域：状态头 + 错误提示 + 变更日志 + 下载进度 */}
      <div className="flex-1 p-5 flex flex-col gap-3 min-h-0 overflow-y-auto">
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
