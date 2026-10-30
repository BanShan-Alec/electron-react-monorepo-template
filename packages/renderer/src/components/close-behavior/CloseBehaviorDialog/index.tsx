import type { CloseBehaviorChoice } from '@app/shared/schemas/close-behavior';
import { t } from '@lingui/core/macro';
import { App, Button } from 'antd';
import { memo, useEffect } from 'react';
import { callIpc } from '@/lib/ipc';

const _CloseBehaviorDialog = (_props: IProps) => {
  const { message, modal } = App.useApp();

  useEffect(() => {
    let currentModal: ReturnType<typeof modal.confirm> | null = null;

    const respond = async (choice: CloseBehaviorChoice) => {
      currentModal?.destroy();
      currentModal = null;
      try {
        await callIpc('window:close-respond', window.api.window.closeRespond, [choice]);
      } catch (error) {
        logger.warn('Failed to submit close behavior choice:', error);
        message.error(t`提交关闭选择失败`);
        if (choice !== 'cancel') {
          currentModal = modal.confirm({
            title: t`关闭窗口还是退出应用？`,
            content: t`选择将被记住，可随时在设置中更改。`,
            closable: true,
            mask: { closable: true },
            keyboard: true,
            okCancel: false,
            onOk: () => {
              void respond('quit');
            },
            footer: () => (
              <div className="flex justify-end gap-2">
                <Button onClick={() => void respond('cancel')}>{t`取消`}</Button>
                <Button onClick={() => void respond('window')}>{t`关闭窗口`}</Button>
                <Button type="primary" onClick={() => void respond('quit')}>
                  {t`退出应用`}
                </Button>
              </div>
            ),
            onCancel: () => {
              void respond('cancel');
            },
          });
        }
      }
    };

    const unsubscribe = window.api.window.onCloseRequested(() => {
      if (currentModal) return;
      currentModal = modal.confirm({
        title: t`关闭窗口还是退出应用？`,
        content: t`选择将被记住，可随时在设置中更改。`,
        closable: true,
        mask: { closable: true },
        keyboard: true,
        okCancel: false,
        onOk: () => {
          void respond('quit');
        },
        footer: () => (
          <div className="flex justify-end gap-2">
            <Button onClick={() => void respond('cancel')}>{t`取消`}</Button>
            <Button onClick={() => void respond('window')}>{t`关闭窗口`}</Button>
            <Button type="primary" onClick={() => void respond('quit')}>
              {t`退出应用`}
            </Button>
          </div>
        ),
        onCancel: () => {
          void respond('cancel');
        },
      });
    });

    void callIpc('window:close-ready', window.api.window.closeReady, []).catch((error) => {
      logger.warn('Failed to register close prompt handler:', error);
    });

    return () => {
      unsubscribe();
      currentModal?.destroy();
    };
  }, [message, modal]);

  return null;
};

type IProps = Record<string, never>;

export const CloseBehaviorDialog = memo(_CloseBehaviorDialog);
