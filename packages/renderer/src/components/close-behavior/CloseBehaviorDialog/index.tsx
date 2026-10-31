import type { CloseBehaviorChoice } from '@app/shared/schemas/close-behavior';
import { t } from '@lingui/core/macro';
import { App, Button } from 'antd';
import { memo, useEffect, useRef } from 'react';
import { callIpc } from '@/lib/ipc';

const _CloseBehaviorDialog = (_props: IProps) => {
  const { message, modal } = App.useApp();
  const trayActionRef = useRef<HTMLButtonElement>(null);

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
        showPrompt();
      }
    };

    const showPrompt = () => {
      if (currentModal) return;
      currentModal = modal.confirm({
        title: t`关闭窗口还是退出应用？`,
        content: t`关闭窗口后，应用会继续在系统托盘中运行。`,
        icon: null,
        closable: true,
        mask: { enabled: true, closable: false },
        keyboard: false,
        okCancel: false,
        focusable: { autoFocusButton: null },
        onCancel: () => {
          void respond('cancel');
        },
        footer: () => (
          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={() => void respond('quit')}>{t`退出应用`}</Button>
            <Button ref={trayActionRef} type="primary" onClick={() => void respond('window')}>
              {t`留在托盘`}
            </Button>
          </div>
        ),
      });
      requestAnimationFrame(() => trayActionRef.current?.focus());
    };

    const unsubscribe = window.api.window.onCloseRequested(showPrompt);
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
