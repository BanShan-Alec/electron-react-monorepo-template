import type React from 'react';
import { Button, Card } from '../../../components/ui';

interface CounterCardProps {
  count: number;
  step: number;
  onStepChange: (step: number) => void;
  isUpdating: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
}

export const CounterCard: React.FC<CounterCardProps> = ({
  count,
  step,
  onStepChange,
  isUpdating,
  onIncrement,
  onDecrement,
  onReset,
}) => {
  return (
    <Card
      title="持久化计数器 (ConfigStore)"
      subtitle="端到端状态变更与本地 JSON 原子防损持久化"
      icon="🔢"
    >
      <div className="flex flex-col items-center justify-center p-4 bg-background-secondary/40 rounded-xl border border-border gap-4">
        <div className="flex flex-col items-center">
          <span className="text-xs text-foreground-secondary font-medium">当前持久化数值</span>
          <span className="text-4xl font-extrabold text-primary font-mono mt-1">{count}</span>
        </div>

        <div className="flex items-center gap-2 w-full max-w-xs">
          <label
            htmlFor="step-select"
            className="text-xs text-foreground-secondary whitespace-nowrap"
          >
            步长:
          </label>
          <select
            id="step-select"
            value={step}
            onChange={(e) => onStepChange(Number(e.target.value))}
            className="bg-background-secondary border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus-ring flex-1"
          >
            <option value={1}>1</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className="flex items-center gap-2.5 w-full justify-center">
          <Button
            size="sm"
            variant="secondary"
            onClick={onDecrement}
            isLoading={isUpdating}
            className="flex-1 max-w-[100px]"
          >
            - {step}
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={onIncrement}
            isLoading={isUpdating}
            className="flex-1 max-w-[100px]"
          >
            + {step}
          </Button>
          <Button size="sm" variant="outline" onClick={onReset} isLoading={isUpdating}>
            重置 0
          </Button>
        </div>
      </div>
    </Card>
  );
};
