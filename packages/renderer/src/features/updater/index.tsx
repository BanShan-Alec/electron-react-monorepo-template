import {
  CheckCircleOutlined,
  CloudDownloadOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  RocketOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Alert, Spin } from 'antd';
import type React from 'react';
import type { ReactNode } from 'react';
import { ActionBar } from './components/ActionBar';
import { ChangelogCard } from './components/ChangelogCard';
import { ProgressCard } from './components/ProgressCard';
import { useUpdater } from './hooks/useUpdater';

export const UpdaterFeature: React.FC = () => {
  useLingui();
  const { snapshot, handleDownload, handleCancel, handleInstall, handleClose, handleRetry } =
    useUpdater();

  const getStatusHeader = (): { title: string; subtitle: string; icon: ReactNode } => {
    switch (snapshot.state) {
      case 'checking':
        return {
          title: t`检查更新中`,
          subtitle: t`正在与更新服务器建立连接，请稍候...`,
          icon: <SyncOutlined spin className="text-primary" />,
        };
      case 'available':
        return {
          title: t`发现新版本`,
          subtitle: t`新版本已经准备就绪，包含最新的功能与改进。`,
          icon: <RocketOutlined className="text-primary" />,
        };
      case 'downloading':
        return {
          title: t`正在下载更新`,
          subtitle: t`安装包下载中，完成后即可进行安装升级。`,
          icon: <CloudDownloadOutlined className="text-primary" />,
        };
      case 'downloaded':
        return {
          title: t`更新已准备就绪`,
          subtitle: t`新版本已完成下载，重启应用后即可完成升级。`,
          icon: <CheckCircleOutlined className="text-success" />,
        };
      case 'up-to-date':
        return {
          title: t`已是最新版本`,
          subtitle: t`当前安装的应用已包含所有最新功能与安全更新。`,
          icon: <CheckCircleOutlined className="text-success" />,
        };
      case 'error':
        return {
          title: t`更新失败`,
          subtitle: t`检查或下载更新时发生异常，请检查网络后重试。`,
          icon: <ExclamationCircleOutlined className="text-danger" />,
        };
      default:
        return {
          title: t`软件更新`,
          subtitle: t`暂无可用更新信息。`,
          icon: <InboxOutlined className="text-primary" />,
        };
    }
  };

  const header = getStatusHeader();
  const showChangelog =
    Boolean(snapshot.version) &&
    (snapshot.state === 'available' ||
      snapshot.state === 'downloading' ||
      snapshot.state === 'downloaded' ||
      snapshot.state === 'error');

  return (
    <div className="h-screen w-screen flex flex-col p-5 bg-background text-foreground select-none overflow-hidden justify-between">
      {/* 标头区域 */}
      <div className="flex items-center gap-3.5 pb-3 border-b border-border">
        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-xl shrink-0">
          {header.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground tracking-tight m-0 truncate">
            {header.title}
          </h2>
          <p className="text-xs text-foreground-muted m-0 mt-0.5 truncate">{header.subtitle}</p>
        </div>
      </div>

      {/* 主体内容区域 */}
      <div className="flex-1 my-3 flex flex-col gap-3 min-h-0 overflow-y-auto stable-scrollbar">
        {snapshot.state === 'checking' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
            <Spin size="large" />
            <span className="text-xs text-foreground-secondary">{t`正在检查更新...`}</span>
          </div>
        )}

        {snapshot.state === 'error' && (
          <Alert
            type="error"
            showIcon
            title={t`更新发生错误`}
            description={snapshot.error || t`下载更新时发生网络异常，请稍后重试。`}
          />
        )}

        {showChangelog && (
          <ChangelogCard
            version={snapshot.version}
            releaseDate={snapshot.releaseDate}
            releaseNotes={snapshot.releaseNotes}
          />
        )}

        {snapshot.state === 'downloading' && <ProgressCard progress={snapshot.progress} />}

        {snapshot.state === 'up-to-date' && (
          <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-foreground-muted">
            {t`您的应用已保持在最新版本，无需更新。`}
          </div>
        )}
      </div>

      {/* 底部按钮栏 */}
      <ActionBar
        state={snapshot.state}
        onDownload={handleDownload}
        onCancel={handleCancel}
        onInstall={handleInstall}
        onClose={handleClose}
        onRetry={handleRetry}
      />
    </div>
  );
};

export default UpdaterFeature;
