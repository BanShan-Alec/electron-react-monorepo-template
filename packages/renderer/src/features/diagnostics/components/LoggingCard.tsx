import type React from 'react';
import { Button, Card } from '../../../components/ui';

interface LoggingCardProps {
  logStatus: string;
  isLoading: boolean;
  onSendLog: (level: 'info' | 'warn' | 'error') => void;
  onOpenLogFolder: () => void;
}

export const LoggingCard: React.FC<LoggingCardProps> = ({
  logStatus,
  isLoading,
  onSendLog,
  onOpenLogFolder,
}) => {
  return (
    <Card
      title="生产分级日志 (LogManager)"
      subtitle="进程隔离落盘 (main.log / renderer.log) 与 5MB 自动轮转"
      icon="📜"
      headerAction={
        <Button size="sm" variant="outline" onClick={onOpenLogFolder} isLoading={isLoading}>
          📂 打开日志目录
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onSendLog('info')}
            isLoading={isLoading}
          >
            ℹ️ 发送 INFO
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onSendLog('warn')}
            isLoading={isLoading}
          >
            ⚠️ 发送 WARN
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => onSendLog('error')}
            isLoading={isLoading}
          >
            🛑 发送 ERROR
          </Button>
        </div>

        {logStatus && (
          <div className="p-3 bg-background-secondary/60 border border-border rounded-lg text-xs font-mono text-foreground">
            {logStatus}
          </div>
        )}
      </div>
    </Card>
  );
};
