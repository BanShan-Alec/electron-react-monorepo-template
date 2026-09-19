import {
  type CalculateResult,
  calculateInputSchema,
  ErrorCode,
  IPC_CHANNELS,
  type Result,
} from '@app/shared';
import { ipcMain } from 'electron';
import { calculatorService } from '../services/calculator.service';
import { catchToResult, failResult, successResult } from './utils';

export function registerCalculatorControllers(): void {
  ipcMain.handle(
    IPC_CHANNELS.CALCULATOR_CALCULATE,
    async (_event, rawInput: unknown): Promise<Result<CalculateResult>> => {
      const parseResult = calculateInputSchema.safeParse(rawInput);
      if (!parseResult.success) {
        return failResult(parseResult.error.issues[0].message, ErrorCode.VALIDATION_ERROR);
      }
      try {
        return successResult(calculatorService.calculate(parseResult.data));
      } catch (err) {
        return catchToResult(err);
      }
    },
  );
}
