export interface CalculateResult {
  a: number;
  b: number;
  op: 'add' | 'subtract' | 'multiply' | 'divide';
  result: number;
}
