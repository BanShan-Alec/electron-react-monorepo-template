import { IPC_CHANNELS } from '@app/shared/constants/ipc-channels';
import type { LogInput } from '@app/shared/schemas/diagnostics';
import type { LoggerApi } from '@app/shared/types/logger';
import { invokeTraced } from './telemetry/ipc-tracer';

const MAX_ARG_DEPTH = 5;

/**
 * 把任意调用参数转成 structured clone 安全值：
 * Error / function / symbol / bigint 等不可克隆类型降级为可读表示，循环引用与超深结构截断。
 * 转换后的结构原样过 IPC，由主进程 util.format 统一格式化——这是 console 变参手感的关键。
 */
function toCloneSafe(value: unknown, depth = 0, ancestors = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;

  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return value;
    case 'bigint':
      return `${value}n`;
    case 'symbol':
      return value.toString();
    case 'function':
      return `[Function ${(value as { name?: string }).name || 'anonymous'}]`;
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  // 以下类型可被 structured clone 原生保留，且 util.inspect 有对应可读渲染
  if (
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Map ||
    value instanceof Set
  ) {
    return value;
  }
  if (depth >= MAX_ARG_DEPTH) return '[max depth]';
  if (ancestors.has(value as object)) return '[Circular]';

  ancestors.add(value as object);
  const converted = Array.isArray(value)
    ? value.map((item) => toCloneSafe(item, depth + 1, ancestors))
    : Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          toCloneSafe(item, depth + 1, ancestors),
        ]),
      );
  ancestors.delete(value as object);
  return converted;
}

function toCloneSafeArgs(args: unknown[]): unknown[] | undefined {
  if (args.length === 0) return undefined;
  return args.map((arg) => toCloneSafe(arg));
}

const emit =
  (level: LogInput['level']) =>
  (message: string, ...args: unknown[]): void => {
    const payload: LogInput = { level, message, args: toCloneSafeArgs(args) };
    void invokeTraced(IPC_CHANNELS.DIAGNOSTICS_LOG, payload).catch(() => {
      // fire-and-forget：日志管道自身的故障不向业务调用方传播
    });
  };

/**
 * 平行于 window.api 的日志桥：方法名即级别、变参、同步 void，调用形态与 console 一致。
 */
export const loggerBridge: LoggerApi = {
  info: emit('info'),
  warn: emit('warn'),
  error: emit('error'),
  debug: emit('debug'),
};
