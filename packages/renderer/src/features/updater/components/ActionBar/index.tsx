import type { UpdaterState } from '@app/shared/types/updater';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Button } from 'antd';
import type React from 'react';

interface ActionBarProps {
  state: UpdaterState;
  onDownload: () => void;
  onCancel: () => void;
  onInstall: () => void;
  onClose: () => void;
  onRetry: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  state,
  onDownload,
  onCancel,
  onInstall,
  onClose,
  onRetry,
}) => {
  useLingui();

  const renderButtons = () => {
    switch (state) {
      case 'checking':
        return <Button onClick={onClose}>{t`关闭`}</Button>;

      case 'available':
        return (
          <>
            <Button onClick={onClose}>{t`稍后提醒`}</Button>
            <Button type="primary" onClick={onDownload}>
              {t`立即更新`}
            </Button>
          </>
        );

      case 'downloading':
        return (
          <>
            <Button onClick={onCancel}>{t`取消下载`}</Button>
            <Button type="primary" onClick={onClose}>
              {t`隐藏到后台`}
            </Button>
          </>
        );

      case 'downloaded':
        return (
          <>
            <Button onClick={onClose}>{t`稍后安装`}</Button>
            <Button type="primary" onClick={onInstall}>
              {t`重启并安装`}
            </Button>
          </>
        );

      case 'up-to-date':
        return (
          <Button type="primary" onClick={onClose}>
            {t`知道了`}
          </Button>
        );

      case 'error':
        return (
          <>
            <Button onClick={onClose}>{t`关闭`}</Button>
            <Button type="primary" onClick={onRetry}>
              {t`重试`}
            </Button>
          </>
        );

      default:
        return <Button onClick={onClose}>{t`关闭`}</Button>;
    }
  };

  return (
    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border mt-auto">
      {renderButtons()}
    </div>
  );
};
