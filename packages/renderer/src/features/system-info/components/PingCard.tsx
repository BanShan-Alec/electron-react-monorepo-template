import type React from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';

interface PingCardProps {
  latency: number | null;
  serverTime: string;
  isPinging: boolean;
  onPing: () => void;
}

export const PingCard: React.FC<PingCardProps> = ({ latency, serverTime, isPinging, onPing }) => {
  return (
    <Card
      title="进程间通信 (IPC Ping)"
      subtitle="Electron ContextBridge & window.api 延迟测量"
      icon="📡"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-background-secondary/40 rounded-xl border border-border">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex flex-col">
            <span className="text-xs text-foreground-secondary font-medium">IPC 通信往返延迟</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-foreground font-mono">
                {latency !== null ? `${latency}` : '--'}
              </span>
              <span className="text-xs text-foreground-muted font-mono">ms</span>
              {latency !== null && (
                <Badge
                  variant={latency < 5 ? 'success' : latency < 15 ? 'primary' : 'warning'}
                  size="sm"
                >
                  {latency < 5 ? '极速' : latency < 15 ? '正常' : '延迟稍高'}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {serverTime && (
            <span className="text-xs text-foreground-secondary font-mono">
              主进程时间: {serverTime}
            </span>
          )}
          <Button onClick={onPing} isLoading={isPinging} size="sm">
            ⚡ 测速 Ping
          </Button>
        </div>
      </div>
    </Card>
  );
};
