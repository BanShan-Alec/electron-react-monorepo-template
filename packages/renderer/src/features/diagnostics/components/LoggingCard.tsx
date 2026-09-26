import { Button, Card } from 'antd';
import { memo } from 'react';
import { CardTitle } from '@/components/ui/CardTitle';
import { statusBoxClass } from '@/lib/classNames';

// 私有常量

// 可抽离的逻辑处理函数/组件

const _LoggingCard = (props: ILoggingCardProps) => {
  // 变量声明、解构
  const { logStatus, isLoading, onSendLog, onOpenLogFolder } = props;

  // 组件状态

  // 网络IO

  // 数据转换

  // 逻辑处理函数

  // 组件Effect

  // 组件渲染
  return (
    <Card
      className="glass-card transition-all duration-200 hover:border-border/80"
      title={
        <CardTitle
          icon="📜"
          title="生产分级日志 (LogManager)"
          subtitle="进程隔离落盘 (main.log / renderer.log) 与 5MB 自动轮转"
        />
      }
      extra={
        <Button size="small" loading={isLoading} onClick={onOpenLogFolder}>
          📂 打开日志目录
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="small" loading={isLoading} onClick={() => onSendLog('info')}>
            ℹ️ 发送 INFO
          </Button>
          <Button size="small" loading={isLoading} onClick={() => onSendLog('warn')}>
            ⚠️ 发送 WARN
          </Button>
          <Button size="small" danger loading={isLoading} onClick={() => onSendLog('error')}>
            🛑 发送 ERROR
          </Button>
        </div>

        {logStatus && <div className={statusBoxClass()}>{logStatus}</div>}
      </div>
    </Card>
  );
};

// props 类型定义
interface ILoggingCardProps {
  logStatus: string;
  isLoading: boolean;
  onSendLog: (level: 'info' | 'warn' | 'error') => void;
  onOpenLogFolder: () => void;
}

const LoggingCard = memo(_LoggingCard);

export { LoggingCard };
export default LoggingCard;
