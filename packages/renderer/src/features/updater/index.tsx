import {
  CheckCircleOutlined,
  CloseOutlined,
  CloudDownloadOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  RocketOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Alert, Button, Card, Spin } from 'antd';
import type React from 'react';
import type { ReactNode } from 'react';
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
    <div className="h-screen w-screen flex flex-col bg-background text-foreground select-none overflow-hidden border border-border">
      {/* 标题栏区域：贴合边缘，支持拖拽移动窗口，右上角保留唯一关闭按钮 */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border bg-background select-none cursor-move shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-base shrink-0">
            {header.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground tracking-tight m-0 truncate">
              {header.title}
            </h2>
            <p className="text-[11px] text-foreground-muted m-0 mt-0.5 truncate">
              {header.subtitle}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          className="text-foreground-muted hover:text-foreground hover:bg-foreground/10 rounded-md p-1.5 transition-colors duration-150 inline-flex items-center justify-center cursor-pointer focus:outline-none shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={handleClose}
        >
          <CloseOutlined className="text-sm" />
        </button>
      </div>

      {/* 主体内容区域：彻底移除独立底部 Footer，业务动作内嵌到各卡片内部 */}
      <div className="flex-1 p-4 flex flex-col gap-3 min-h-0 overflow-y-auto stable-scrollbar">
        {snapshot.state === 'checking' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
            <Spin size="large" />
            <span className="text-xs text-foreground-secondary">{t`正在检查更新...`}</span>
          </div>
        )}

        {snapshot.state === 'up-to-date' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2.5 p-6 text-center">
            <CheckCircleOutlined className="text-success text-3xl mb-1" />
            <span className="text-sm font-medium text-foreground">{t`已是最新版本`}</span>
            <span className="text-xs text-foreground-muted">{t`您的应用已保持在最新版本，无需更新。`}</span>
          </div>
        )}

        {snapshot.state === 'error' && (
          <div className="bg-background-secondary border border-border rounded-lg p-4 flex flex-col gap-3">
            <Alert
              type="error"
              showIcon
              title={t`更新发生错误`}
              description={snapshot.error || t`下载更新时发生网络异常，请稍后重试。`}
            />
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button onClick={handleClose}>{t`关闭`}</Button>
              <Button type="primary" onClick={handleRetry}>{t`重试`}</Button>
            </div>
          </div>
        )}

        {showChangelog && (
          <div className="flex flex-col gap-2">
            <ChangelogCard
              version={snapshot.version}
              releaseDate={snapshot.releaseDate}
              releaseNotes={snapshot.releaseNotes}
            />
            {snapshot.state === 'available' && (
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button onClick={handleClose}>{t`稍后提醒`}</Button>
                <Button type="primary" onClick={handleDownload}>{t`立即更新`}</Button>
              </div>
            )}
            {snapshot.state === 'downloaded' && (
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button onClick={handleClose}>{t`稍后安装`}</Button>
                <Button type="primary" onClick={handleInstall}>{t`重启并安装`}</Button>
              </div>
            )}
          </div>
        )}

        {snapshot.state === 'downloading' && (
          <div className="flex flex-col gap-2">
            <ProgressCard progress={snapshot.progress} />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button onClick={handleCancel}>{t`取消下载`}</Button>
              <Button type="primary" onClick={handleClose}>{t`隐藏到后台`}</Button>
            </div>
          </div>
        )}

        {!showChangelog && snapshot.state === 'downloaded' && (
          <Card size="small" className="bg-background-secondary border border-border rounded-lg">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircleOutlined className="text-success text-2xl shrink-0" />
                <div className="text-xs text-foreground-muted">
                  {t`新版本已完成下载，重启应用后即可完成升级。`}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button onClick={handleClose}>{t`稍后安装`}</Button>
                <Button type="primary" onClick={handleInstall}>{t`重启并安装`}</Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default UpdaterFeature;
