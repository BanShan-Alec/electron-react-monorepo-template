import { APP_ENV } from '@app/shared/constants/env';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import * as Sentry from '@sentry/electron/renderer';
import { Button, Empty } from 'antd';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface IErrorBoundaryProps {
  children: ReactNode;
  /** 发生未捕获异常时的自定义业务回调（如自定义日志或状态通知） */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface IErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

interface IFallbackProps {
  error: unknown;
  resetError?: () => void;
}

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

export class ErrorBoundary extends Component<IErrorBoundaryProps, IErrorBoundaryState> {
  constructor(props: IErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: unknown): IErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 1. 渲染进程崩溃捕获并上报至 Sentry
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });

    // 2. 执行外部业务传入的 onError 回调
    this.props.onError?.(error, errorInfo);
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return <FallbackView error={this.state.error} resetError={this.resetError} />;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
