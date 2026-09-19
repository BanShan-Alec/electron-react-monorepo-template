export type CalcOperator = 'add' | 'subtract' | 'multiply' | 'divide';

export interface CalculatorState {
  a: number;
  b: number;
  op: CalcOperator;
  result: number | null;
  error: string | null;
  isLoading: boolean;
}
