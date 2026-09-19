import { useState } from 'react';
import type { CalcOperator } from '../types';

export function useCalculator() {
  const [a, setA] = useState<number>(10);
  const [b, setB] = useState<number>(2);
  const [op, setOp] = useState<CalcOperator>('divide');
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const calculate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await window.api.calculator.calculate({ a, b, op });
      if (res.success) {
        setResult(res.data.result);
      } else {
        setResult(null);
        setError(res.error);
      }
    } catch (err: unknown) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Calculation error');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    a,
    setA,
    b,
    setB,
    op,
    setOp,
    result,
    error,
    isLoading,
    calculate,
  };
}
