import type React from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import type { CalcOperator } from '../types';

interface CalculatorCardProps {
  a: number;
  b: number;
  op: CalcOperator;
  onAChange: (val: number) => void;
  onBChange: (val: number) => void;
  onOpChange: (op: CalcOperator) => void;
  result: number | null;
  error: string | null;
  isLoading: boolean;
  onCalculate: () => void;
}

export const CalculatorCard: React.FC<CalculatorCardProps> = ({
  a,
  b,
  op,
  onAChange,
  onBChange,
  onOpChange,
  result,
  error,
  isLoading,
  onCalculate,
}) => {
  return (
    <Card
      title="安全计算器 (IPC 错误处理)"
      subtitle="Zod 严格模式入参校验与语义化错误码 Result 契约"
      icon="🧮"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={a}
            onChange={(e) => onAChange(Number(e.target.value))}
            placeholder="操作数 A"
            className="font-mono text-center"
          />

          <select
            value={op}
            onChange={(e) => onOpChange(e.target.value as CalcOperator)}
            className="bg-background-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground focus-ring font-bold"
          >
            <option value="add">+</option>
            <option value="subtract">-</option>
            <option value="multiply">×</option>
            <option value="divide">÷</option>
          </select>

          <Input
            type="number"
            value={b}
            onChange={(e) => onBChange(Number(e.target.value))}
            placeholder="操作数 B"
            className="font-mono text-center"
          />

          <Button onClick={onCalculate} isLoading={isLoading} size="md">
            =
          </Button>
        </div>

        {result !== null && (
          <div className="p-3 bg-success/10 border border-success/30 rounded-lg flex items-center justify-between">
            <span className="text-xs text-foreground-secondary font-medium">计算结果:</span>
            <span className="text-base font-bold text-success font-mono">{result}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg flex items-start gap-2 text-xs text-danger">
            <span>⚠️</span>
            <span className="font-mono font-medium">{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-foreground-muted mt-1 pt-2 border-t border-border/40">
          <span>提示：尝试输入 B = 0 并选择除法 (÷) 触发服务端异常拦截</span>
          <Badge variant="neutral" size="sm">
            Zod 校验
          </Badge>
        </div>
      </div>
    </Card>
  );
};
