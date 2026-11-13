import { ApiOutlined, InfoCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Button, Tooltip } from 'antd';
import { memo } from 'react';
import { AppCard } from '@/components/ui/AppCard';
import { CardTitle } from '@/components/ui/CardTitle';
import { StatusTag } from '@/components/ui/StatusTag';
import type { PingTimingBreakdown } from '../../hooks/usePing';

// 私有常量
const FAST_LATENCY_MS = 5;
const NORMAL_LATENCY_MS = 15;

// 可抽离的逻辑处理函数/组件
function LatencyTag({ latency }: { latency: number }) {
  // 订阅语言上下文：渲染在组件内完成，避免模块级函数被 React Compiler 按 latency 缓存
  useLingui();
  if (latency < FAST_LATENCY_MS) {
    return <StatusTag tone="success">{t`极速`}</StatusTag>;
  }
  if (latency < NORMAL_LATENCY_MS) {
    return <StatusTag tone="info">{t`正常`}</StatusTag>;
  }
  return <StatusTag tone="warning">{t`延迟稍高`}</StatusTag>;
}

const _PingCard = (props: PingCardProps) => {
  useLingui();
  // 变量声明、解构
  const { latency, timing, isPinging, onPing } = props;

  // 组件状态

  // 网络IO

  // 数据转换
  const total = timing ? timing.renderMs + timing.queueMs + timing.ipcMs + timing.mainMs || 1 : 1;
  const renderPct = timing
    ? Math.max(timing.renderMs > 0 ? 5 : 0, Math.round((timing.renderMs / total) * 100))
    : 0;
  const queuePct = timing
    ? Math.max(timing.queueMs > 0 ? 5 : 0, Math.round((timing.queueMs / total) * 100))
    : 0;
  const mainPct = timing
    ? Math.max(timing.mainMs > 0 ? 5 : 0, Math.round((timing.mainMs / total) * 100))
    : 0;
  const ipcPct = timing ? Math.max(5, 100 - renderPct - queuePct - mainPct) : 0;

  // 逻辑处理函数

  // 组件Effect

  // 组件渲染
  return (
    <AppCard
      title={
        <CardTitle
          icon={<ApiOutlined />}
          title={t`进程间通信 (IPC Ping)`}
          subtitle={t`结合 libuv 原生探针与 ContextBridge，精确解耦全链路延迟`}
        />
      }
    >
      <div className="flex flex-1 flex-col justify-between gap-4 p-4 bg-background-sunken rounded-lg border border-border">
        {/* 上半部：总延迟指标 + 测速操作 */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex flex-col">
              <span className="text-xs text-foreground-secondary font-medium">
                {t`IPC 通信往返延迟`}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-semibold text-foreground font-mono">
                  {latency !== null ? `${latency}` : '--'}
                </span>
                <span className="text-xs text-foreground-secondary font-mono">ms</span>
                {latency !== null && <LatencyTag latency={latency} />}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-start sm:justify-end w-full sm:w-auto">
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

        {/* 下半部：4 阶段端到端时序流（彩色分段条 + 耗时标注） */}
        <div className="pt-3 border-t border-border/60 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-foreground-secondary">
            <span className="font-medium">{t`端到端链路耗时分解`}</span>
            <span className="font-mono text-xs">{timing ? `${timing.totalMs} ms` : '--'}</span>
          </div>

          {/* 分段彩色进度条 */}
          <div className="h-2.5 w-full rounded-full bg-border/40 overflow-hidden flex items-center">
            {timing ? (
              <>
                <Tooltip title={t`渲染调度: ${timing.renderMs}ms`}>
                  <div
                    style={{ width: `${renderPct}%` }}
                    className="h-full bg-emerald-500 transition-all duration-300 hover:opacity-85 cursor-pointer"
                  />
                </Tooltip>
                {queuePct > 0 && (
                  <Tooltip
                    title={t`页面首屏正忙于挂载各功能组件与渲染，测速回调在任务队列排队；再次测速即恢复极速`}
                  >
                    <div
                      style={{ width: `${queuePct}%` }}
                      className="h-full bg-amber-500 transition-all duration-300 hover:opacity-85 cursor-pointer"
                    />
                  </Tooltip>
                )}
                <Tooltip title={t`IPC 传输: ${timing.ipcMs}ms`}>
                  <div
                    style={{ width: `${ipcPct}%` }}
                    className="h-full bg-primary transition-all duration-300 hover:opacity-85 cursor-pointer"
                  />
                </Tooltip>
                <Tooltip title={t`主进程: ${timing.mainMs}ms`}>
                  <div
                    style={{ width: `${mainPct}%` }}
                    className="h-full bg-purple-500 transition-all duration-300 hover:opacity-85 cursor-pointer"
                  />
                </Tooltip>
              </>
            ) : (
              <div className="h-full w-full bg-border/40" />
            )}
          </div>

          {/* 4 阶段图例与毫秒数值 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-0.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-foreground-secondary truncate">{t`渲染调度`}:</span>
              <span className="font-mono font-medium text-foreground ml-auto sm:ml-0">
                {timing ? `${timing.renderMs}ms` : '--'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Tooltip
                title={t`页面首屏正忙于挂载各功能组件与渲染，测速回调在任务队列排队；再次测速即恢复极速`}
              >
                <span className="size-2 rounded-full bg-amber-500 shrink-0 cursor-help hover:scale-125 transition-transform" />
              </Tooltip>
              <span className="text-foreground-secondary truncate">{t`排队等待`}:</span>
              <span className="font-mono font-medium text-foreground ml-auto sm:ml-0">
                {timing ? `${timing.queueMs}ms` : '--'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary shrink-0" />
              <span className="text-foreground-secondary truncate">{t`IPC 传输`}:</span>
              <span className="font-mono font-medium text-foreground ml-auto sm:ml-0">
                {timing ? `${timing.ipcMs}ms` : '--'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-purple-500 shrink-0" />
              <span className="text-foreground-secondary truncate">{t`主进程`}:</span>
              <span className="font-mono font-medium text-foreground ml-auto sm:ml-0">
                {timing ? `${timing.mainMs}ms` : '--'}
              </span>
            </div>
          </div>

          {/* 探针方案说明 */}
          <div className="flex items-center gap-1.5 text-xs text-foreground-secondary/75 pt-1">
            <InfoCircleOutlined className="shrink-0 text-foreground-tertiary" />
            <span className="truncate">
              {t`探针机制：结合主进程 libuv 原生探针与高精度打点，精准解耦排队与通信耗时`}
            </span>
          </div>
        </div>
      </div>
    </AppCard>
  );
};

// props 类型定义
interface PingCardProps {
  latency: number | null;
  timing: PingTimingBreakdown | null;
  isPinging: boolean;
  onPing: () => void;
}

export const PingCard = memo(_PingCard);
