import type React from 'react';
import { Button, Card } from '../../../components/ui';

interface DialogCardProps {
  selectedPath: string;
  statusMessage: string;
  isLoading: boolean;
  onOpenFile: () => void;
  onOpenDirectory: () => void;
  onSaveFile: () => void;
  onShowInFolder: () => void;
}

export const DialogCard: React.FC<DialogCardProps> = ({
  selectedPath,
  statusMessage,
  isLoading,
  onOpenFile,
  onOpenDirectory,
  onSaveFile,
  onShowInFolder,
}) => {
  return (
    <Card
      title="原生对话框与文件定位 (Native Dialogs)"
      subtitle="经由安全 Controller & Preload 调起系统文件管理器与访达"
      icon="📂"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onOpenFile} isLoading={isLoading}>
            📄 选择文件
          </Button>
          <Button size="sm" variant="secondary" onClick={onOpenDirectory} isLoading={isLoading}>
            📁 选择目录
          </Button>
          <Button size="sm" variant="secondary" onClick={onSaveFile} isLoading={isLoading}>
            💾 另存为
          </Button>
          <Button size="sm" variant="outline" onClick={onShowInFolder} disabled={!selectedPath}>
            🔍 在资源管理器中定位
          </Button>
        </div>

        {statusMessage && (
          <div className="p-3 bg-background-secondary/60 border border-border rounded-lg text-xs font-mono text-foreground break-all">
            {statusMessage}
          </div>
        )}
      </div>
    </Card>
  );
};
