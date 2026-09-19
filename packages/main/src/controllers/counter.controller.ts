import {
  type CounterResult,
  ErrorCode,
  IPC_CHANNELS,
  type Result,
  stepInputSchema,
} from '@app/shared';
import { ipcMain } from 'electron';
import { counterService } from '../services/counter.service';
import { catchToResult, failResult, successResult } from './utils';

export function registerCounterControllers(): void {
  ipcMain.handle(IPC_CHANNELS.COUNTER_GET, async (): Promise<Result<CounterResult>> => {
    try {
      return successResult(counterService.getCounter());
    } catch (err) {
      return catchToResult(err);
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.COUNTER_INCREMENT,
    async (_event, rawInput: unknown): Promise<Result<CounterResult>> => {
      const parseResult = stepInputSchema.safeParse(rawInput ?? {});
      if (!parseResult.success) {
        return failResult(parseResult.error.issues[0].message, ErrorCode.VALIDATION_ERROR);
      }
      try {
        return successResult(counterService.increment(parseResult.data.step));
      } catch (err) {
        return catchToResult(err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.COUNTER_DECREMENT,
    async (_event, rawInput: unknown): Promise<Result<CounterResult>> => {
      const parseResult = stepInputSchema.safeParse(rawInput ?? {});
      if (!parseResult.success) {
        return failResult(parseResult.error.issues[0].message, ErrorCode.VALIDATION_ERROR);
      }
      try {
        return successResult(counterService.decrement(parseResult.data.step));
      } catch (err) {
        return catchToResult(err);
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.COUNTER_RESET, async (): Promise<Result<CounterResult>> => {
    try {
      return successResult(counterService.reset());
    } catch (err) {
      return catchToResult(err);
    }
  });
}
