import type { CalculateInput } from '@shared/schemas/calculator';
import type { CalcOperator, CalculateResult } from '@shared/types/calculator';
import { App } from 'antd';
import { useState } from 'react';
import { useManualRequest } from '@/hooks/useManualRequest';

// 私有常量
const DEFAULT_OPERAND_A = 10;
const DEFAULT_OPERAND_B = 2;
const DEFAULT_OPERATOR: CalcOperator = 'divide';

// 可抽离的逻辑处理函数/组件

export function useCalculator() {
  const { message } = App.useApp();
  const [a, setA] = useState<number>(DEFAULT_OPERAND_A);
  const [b, setB] = useState<number>(DEFAULT_OPERAND_B);
  const [op, setOp] = useState<CalcOperator>(DEFAULT_OPERATOR);

  // 网络IO（显式触发）—— 用户点击触发的 IPC 计算（过期响应自动丢弃）
  const {
    data: result,
    error,
    loading: isLoading,
    runAsync: calculateAsync,
  } = useManualRequest(
    async (input: CalculateInput) => {
      const res = await window.api.calculator.calculate(input);
      if (!res.success) {
        throw new Error(res.error);
      }
      return (res.data as CalculateResult).result;
    },
    {
      onError: (err) => {
        message.error(`计算失败: ${err.message}`);
      },
    },
  );

  // 逻辑处理函数
  const calculate = () => {
    void calculateAsync({ a, b, op }).catch(() => {
      // 过期响应 CancelledError 与业务异常均已丢弃/提示，此处防止未处理拒绝
    });
  };

  return {
    a,
    setA,
    b,
    setB,
    op,
    setOp,
    result: result ?? null,
    error: error?.message ?? null,
    isLoading,
    calculate,
  };
}
