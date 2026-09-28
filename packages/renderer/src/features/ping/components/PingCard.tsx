import { ApiOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Button, Card, Tag } from 'antd';
import { memo } from 'react';
import { CardTitle } from '@/components/ui/CardTitle';

// 私有常量
const FAST_LATENCY_MS = 5;
const NORMAL_LATENCY_MS = 15;

// 可抽离的逻辑处理函数/组件
function renderLatencyTag(latency: number) {
  if (latency < FAST_LATENCY_MS) {
    return <Tag color="success">{t`极速`}</Tag>;
  }
  if (latency < NORMAL_LATENCY_MS) {
    return <Tag color="processing">{t`正常`}</Tag>;
  }
  return <Tag color="warning">{t`延迟稍高`}</Tag>;
}

const _PingCard = (props: IPingCardProps) => {
  useLingui();
  // 变量声明、解构
  const { latency, serverTime, isPinging, onPing } = props;

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
          icon={<ApiOutlined />}
          title={t`进程间通信 (IPC Ping)`}
          subtitle={t`Electron ContextBridge & window.api 延迟测量`}
        />
      }
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-background-secondary rounded-lg border border-border">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex flex-col">
            <span className="text-xs text-foreground-secondary font-medium">
              {t`IPC 通信往返延迟`}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold text-foreground font-mono">
                {latency !== null ? `${latency}` : '--'}
              </span>
              <span className="text-xs text-foreground-muted font-mono">ms</span>
              {latency !== null && renderLatencyTag(latency)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {serverTime && (
            <span className="text-xs text-foreground-secondary font-mono">
              {t`主进程时间`}: {serverTime}
            </span>
          )}
          <Button
            type="primary"
            size="small"
            icon={<ThunderboltOutlined />}
            loading={isPinging}
            onClick={onPing}
          >
            {t`测速 Ping`}
          </Button>
        </div>
      </div>
    </Card>
  );
};

// props 类型定义
interface IPingCardProps {
  latency: number | null;
  serverTime: string;
  isPinging: boolean;
  onPing: () => void;
}

const PingCard = memo(_PingCard);

export { PingCard };
export default PingCard;
