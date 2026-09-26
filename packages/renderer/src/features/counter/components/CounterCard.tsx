import { Button, Card, Select } from 'antd';
import { memo } from 'react';
import { CardTitle } from '@/components/ui/CardTitle';

// 私有常量
const STEP_OPTIONS = [1, 5, 10, 50];

// 可抽离的逻辑处理函数/组件
function toSelectOptions(steps: number[]) {
  return steps.map((step) => ({ label: String(step), value: step }));
}

const _CounterCard = (props: ICounterCardProps) => {
  // 变量声明、解构
  const { count, step, onStepChange, isUpdating, onIncrement, onDecrement, onReset } = props;

  // 组件状态

  // 网络IO

  // 数据转换
  const selectOptions = toSelectOptions(STEP_OPTIONS);

  // 逻辑处理函数

  // 组件Effect

  // 组件渲染
  return (
    <Card
      className="glass-card transition-all duration-200 hover:border-border/80"
      title={
        <CardTitle
          icon="🔢"
          title="持久化计数器 (ConfigStore)"
          subtitle="端到端状态变更与本地 JSON 原子防损持久化"
        />
      }
    >
      <div className="flex flex-col items-center justify-center p-4 bg-background-secondary rounded-lg border border-border gap-4">
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
          <Select
            id="step-select"
            className="flex-1"
            value={step}
            options={selectOptions}
            onChange={onStepChange}
          />
        </div>

        <div className="flex items-center gap-2.5 w-full justify-center">
          <Button size="small" loading={isUpdating} onClick={onDecrement}>
            - {step}
          </Button>
          <Button size="small" type="primary" loading={isUpdating} onClick={onIncrement}>
            + {step}
          </Button>
          <Button size="small" loading={isUpdating} onClick={onReset}>
            重置 0
          </Button>
        </div>
      </div>
    </Card>
  );
};

// props 类型定义
interface ICounterCardProps {
  count: number;
  step: number;
  onStepChange: (step: number) => void;
  isUpdating: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
}

const CounterCard = memo(_CounterCard);

export { CounterCard };
export default CounterCard;
