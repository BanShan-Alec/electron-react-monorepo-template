import * as Sentry from '@sentry/react';
import { Button, Empty } from 'antd';
import type { ReactNode } from 'react';

/**
 * 全局渲染异常兜底（基于 Sentry.ErrorBoundary 实现）。
 * 视觉风格与交互对齐 vite-nginx-template：Empty 缺省图 + 刷新重试，区分 DEV 与生产环境文案。
 */

// 私有常量
const DEFAULT_ERROR_DESC = '页面出错啦~';

interface IErrorBoundaryProps {
  children: ReactNode;
}

interface IFallbackProps {
  error: unknown;
  resetError?: () => void;
}

// 可抽离的逻辑处理函数/组件
function FallbackView({ error, resetError }: IFallbackProps) {
  const errorMessage = error instanceof Error ? error.message : String(error || '');
  const description = import.meta.env.DEV
    ? errorMessage || '渲染进程发生未捕获错误'
    : DEFAULT_ERROR_DESC;

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
        刷新重试
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
