import type React from 'react';
import { Button, Card } from '../../../components/ui';
import type { SystemInfo } from '../types';

interface SystemInfoCardProps {
  systemInfo: SystemInfo | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const SystemInfoCard: React.FC<SystemInfoCardProps> = ({
  systemInfo,
  isLoading,
  onRefresh,
}) => {
  return (
    <Card
      title="系统与运行环境"
      subtitle="Electron & Node.js 原生底层探针"
      icon="💻"
      headerAction={
        <Button size="sm" variant="outline" onClick={onRefresh} isLoading={isLoading}>
          🔄 刷新
        </Button>
      }
    >
      {systemInfo ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-background-secondary/60 p-2.5 rounded-lg border border-border/60">
            <span className="text-foreground-secondary block text-[11px]">平台架构</span>
            <span className="font-semibold text-foreground mt-0.5 block font-mono">
              {systemInfo.platform} ({systemInfo.arch})
            </span>
          </div>

          <div className="bg-background-secondary/60 p-2.5 rounded-lg border border-border/60">
            <span className="text-foreground-secondary block text-[11px]">Electron 版本</span>
            <span className="font-semibold text-foreground mt-0.5 block font-mono">
              v{systemInfo.electronVersion}
            </span>
          </div>

          <div className="bg-background-secondary/60 p-2.5 rounded-lg border border-border/60">
            <span className="text-foreground-secondary block text-[11px]">Node.js 版本</span>
            <span className="font-semibold text-foreground mt-0.5 block font-mono">
              v{systemInfo.nodeVersion}
            </span>
          </div>

          <div className="bg-background-secondary/60 p-2.5 rounded-lg border border-border/60">
            <span className="text-foreground-secondary block text-[11px]">Chromium 版本</span>
            <span className="font-semibold text-foreground mt-0.5 block font-mono">
              v{systemInfo.chromeVersion}
            </span>
          </div>

          <div className="bg-background-secondary/60 p-2.5 rounded-lg border border-border/60">
            <span className="text-foreground-secondary block text-[11px]">CPU 核心 / 架构</span>
            <span className="font-semibold text-foreground mt-0.5 block font-mono truncate">
              {systemInfo.cpuCores} 核 ({systemInfo.cpuModel})
            </span>
          </div>

          <div className="bg-background-secondary/60 p-2.5 rounded-lg border border-border/60">
            <span className="text-foreground-secondary block text-[11px]">可用内存 / 总内存</span>
            <span className="font-semibold text-foreground mt-0.5 block font-mono">
              {systemInfo.freeMemoryMB} MB / {systemInfo.totalMemoryMB} MB
            </span>
          </div>

          <div className="bg-background-secondary/60 p-2.5 rounded-lg border border-border/60">
            <span className="text-foreground-secondary block text-[11px]">主进程堆内存占用</span>
            <span className="font-semibold text-primary mt-0.5 block font-mono">
              {systemInfo.heapUsedMB} MB / {systemInfo.heapTotalMB} MB
            </span>
          </div>

          <div className="bg-background-secondary/60 p-2.5 rounded-lg border border-border/60">
            <span className="text-foreground-secondary block text-[11px]">系统运行时间</span>
            <span className="font-semibold text-foreground mt-0.5 block font-mono">
              {Math.floor(systemInfo.uptimeSeconds / 60)} 分钟 ({systemInfo.uptimeSeconds} 秒)
            </span>
          </div>

          <div className="bg-background-secondary/60 p-2.5 rounded-lg border border-border/60">
            <span className="text-foreground-secondary block text-[11px]">V8 引擎版本</span>
            <span className="font-semibold text-foreground mt-0.5 block font-mono">
              v{systemInfo.v8Version}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6 text-foreground-muted text-xs">
          正在探测系统运行环境...
        </div>
      )}
    </Card>
  );
};
