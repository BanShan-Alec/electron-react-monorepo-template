import { APP_ENV } from '@app/shared/constants/env';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import * as Sentry from '@sentry/react';
import { Button, Empty } from 'antd';
import type { ReactNode } from 'react';

// 私有常量

interface IErrorBoundaryProps {
  children: ReactNode;
}

interface IFallbackProps {
  error: unknown;
  resetError?: () => void;
}

// 可抽离的逻辑处理函数/组件
function FallbackView({ error, resetError }: IFallbackProps) {
  useLingui();
  const isDev = window.__APP_ENV__?.mode === APP_ENV.DEVELOPMENT;
  const errorMessage = error instanceof Error ? error.message : String(error || '');
  const description = isDev ? errorMessage || t`渲染进程发生未捕获错误` : t`页面出错啦~`;

  const handleReload = (): void => {
    if (resetError) {
      resetError();
    }
    window.location.reload();
  };

  return (
    <div className="h-full min-h-[360px] w-full flex flex-col items-center justify-center gap-6 p-6">
      <Empty image={Empty.PRESENTED_IMAGE_DEFAULT} description={description} />
      <Button type="primary" onClick={handleReload}>
        {t`刷新重试`}
      </Button>
    </div>
  );
}

export function ErrorBoundary({ children }: IErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => <FallbackView error={error} resetError={resetError} />}
      showDialog={false}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

export default ErrorBoundary;
