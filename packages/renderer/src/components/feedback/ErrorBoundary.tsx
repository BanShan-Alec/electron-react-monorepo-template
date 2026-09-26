import { Button, Result } from 'antd';
import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * 全局渲染异常兜底（对齐 renderer/directory-structure.md 的 components/feedback/ 定位）。
 * 类组件为 React 官方推荐的错误边界实现形态，不适用函数式 7 段式模板。
 */

// 私有常量
const FALLBACK_TITLE = '页面出现异常';
const FALLBACK_SUBTITLE = '渲染进程发生未捕获错误，请重试或重启应用。';

interface IErrorBoundaryProps {
  children: ReactNode;
}

interface IErrorBoundaryState {
  error: Error | null;
}

// 可抽离的逻辑处理函数/组件

export class ErrorBoundary extends Component<IErrorBoundaryProps, IErrorBoundaryState> {
  state: IErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): IErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] 渲染异常:', error, errorInfo.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    return (
      <Result
        status="error"
        title={FALLBACK_TITLE}
        subTitle={error.message || FALLBACK_SUBTITLE}
        extra={
          <Button type="primary" onClick={this.handleReload}>
            重新加载
          </Button>
        }
      />
    );
  }
}

export default ErrorBoundary;
