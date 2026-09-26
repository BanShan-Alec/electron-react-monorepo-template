import type { SystemInfo } from '@shared/types/system';
import { Button, Card, Skeleton } from 'antd';
import { memo } from 'react';
import { CardTitle } from '@/components/ui/CardTitle';

// 私有常量
const INFO_GRID_CLASS = 'grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs';
const INFO_CELL_CLASS = 'bg-background-secondary p-2.5 rounded-lg border border-border/60';

// 可抽离的逻辑处理函数/组件
function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className={INFO_CELL_CLASS}>
      <span className="text-foreground-secondary block text-[11px]">{label}</span>
      <span className="font-semibold text-foreground mt-0.5 block font-mono">{value}</span>
    </div>
  );
}

const _SystemInfoCard = (props: ISystemInfoCardProps) => {
  // 变量声明、解构
  const { systemInfo, isLoading, onRefresh } = props;

  // 组件状态

  // 网络IO

  // 数据转换
  const showSkeleton = isLoading && systemInfo === null;

  // 逻辑处理函数

  // 组件Effect

  // 组件渲染
  return (
    <Card
      className="glass-card transition-all duration-200 hover:border-border/80"
      title={
        <CardTitle icon="💻" title="系统与运行环境" subtitle="Electron & Node.js 原生底层探针" />
      }
      extra={
        <Button size="small" loading={isLoading} onClick={onRefresh}>
          🔄 刷新
        </Button>
      }
    >
      {showSkeleton ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : systemInfo ? (
        <div className={INFO_GRID_CLASS}>
          <InfoCell label="平台架构" value={`${systemInfo.platform} (${systemInfo.arch})`} />
          <InfoCell label="Electron 版本" value={`v${systemInfo.electronVersion}`} />
          <InfoCell label="Node.js 版本" value={`v${systemInfo.nodeVersion}`} />
          <InfoCell label="Chromium 版本" value={`v${systemInfo.chromeVersion}`} />
          <InfoCell
            label="CPU 核心 / 架构"
            value={`${systemInfo.cpuCores} 核 (${systemInfo.cpuModel})`}
          />
          <InfoCell
            label="可用内存 / 总内存"
            value={`${systemInfo.freeMemoryMB} MB / ${systemInfo.totalMemoryMB} MB`}
          />
          <InfoCell
            label="主进程堆内存占用"
            value={`${systemInfo.heapUsedMB} MB / ${systemInfo.heapTotalMB} MB`}
          />
          <InfoCell
            label="系统运行时间"
            value={`${Math.floor(systemInfo.uptimeSeconds / 60)} 分钟 (${systemInfo.uptimeSeconds} 秒)`}
          />
          <InfoCell label="V8 引擎版本" value={`v${systemInfo.v8Version}`} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6 text-foreground-muted text-xs">
          正在探测系统运行环境...
        </div>
      )}
    </Card>
  );
};

// props 类型定义
interface ISystemInfoCardProps {
  systemInfo: SystemInfo | null;
  isLoading: boolean;
  onRefresh: () => void;
}

const SystemInfoCard = memo(_SystemInfoCard);

export { SystemInfoCard };
export default SystemInfoCard;
