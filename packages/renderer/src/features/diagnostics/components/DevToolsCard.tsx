import type React from 'react';
import { Button, Card } from '../../../components/ui';

interface DevToolsCardProps {
  actionMessage: string;
  onToggleDevTools: () => void;
  onOpenDocs: () => void;
}

export const DevToolsCard: React.FC<DevToolsCardProps> = ({
  actionMessage,
  onToggleDevTools,
  onOpenDocs,
}) => {
  return (
    <Card
      title="调试与系统外链 (Security Filter)"
      subtitle="严格协议白名单校验 (仅允许 http/https) 与 DevTools 控制"
      icon="🛠️"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onToggleDevTools}>
            🪟 开关 DevTools
          </Button>
          <Button size="sm" variant="secondary" onClick={onOpenDocs}>
            🌐 打开 GitHub 页面
          </Button>
        </div>

        {actionMessage && (
          <div className="p-3 bg-background-secondary/60 border border-border rounded-lg text-xs font-mono text-foreground">
            {actionMessage}
          </div>
        )}
      </div>
    </Card>
  );
};
