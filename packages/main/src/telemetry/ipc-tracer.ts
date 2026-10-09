import type { SpanContext, TracedIpcPayload } from '@app/shared/types/telemetry';
import type { IpcMainInvokeEvent } from 'electron';
import { BrowserWindow, ipcMain } from 'electron';
import { getLogManager } from '../modules/log.module';
import { getWindowName } from '../modules/window/window-registry';
import { getTracer } from './tracer';

export type TracedHandler<T = unknown, R = unknown> = (
  event: IpcMainInvokeEvent,
  data: T,
) => Promise<R> | R;

/**
 * 判断入参是否符合 TracedIpcPayload 包装规范
 */
export function isTracedIpcPayload<T = unknown>(value: unknown): value is TracedIpcPayload<T> {
  return (
    typeof value === 'object' && value !== null && '__trace_carrier' in value && 'data' in value
  );
}

/**
 * 包装 ipcMain.handle，实现请求链路追踪与上下文自动透传
 */
export function handleTraced<T = unknown, R = unknown>(
  channel: string,
  handler: TracedHandler<T, R>,
): void {
  ipcMain.handle(channel, async (event: IpcMainInvokeEvent, rawInput: unknown): Promise<R> => {
    const tracer = getTracer();
    let data: T;
    let parentContext: SpanContext | undefined;

    if (isTracedIpcPayload<T>(rawInput)) {
      data = rawInput.data;
      if (rawInput.__trace_carrier) {
        parentContext = tracer.extract(
          rawInput.__trace_carrier as Record<string, string | undefined>,
        );
      }
    } else {
      // 兼容非包装调用的降级处理
      data = rawInput as T;
    }

    const senderWin = event.sender ? BrowserWindow.fromWebContents(event.sender) : null;
    const windowId = senderWin?.id;
    const windowName = senderWin ? getWindowName(senderWin) : undefined;

    return tracer.startActiveSpan(
      `ipc.receive:${channel}`,
      {
        parentContext,
        attributes: {
          'ipc.channel': channel,
          'rpc.system': 'electron-ipc',
          ...(windowId !== undefined ? { 'window.id': windowId } : {}),
          ...(windowName ? { 'window.name': windowName } : {}),
        },
      },
      async (span) => {
        const winTag = windowName ? `[${windowName}] ` : windowId ? `[win#${windowId}] ` : '';
        getLogManager().scoped('IPC').info(`${winTag}Handling ${channel}`);
        try {
          const result = await handler(event, data);
          // 若业务返回了 Result 结构体，可辅助记录业务结果状态
          if (
            result &&
            typeof result === 'object' &&
            'success' in result &&
            typeof (result as { success: unknown }).success === 'boolean'
          ) {
            const res = result as { success: boolean; error?: string; code?: string };
            span.setAttributes({
              'app.result_success': res.success,
              ...(res.code ? { 'app.result_code': res.code } : {}),
            });
            if (!res.success && res.error) {
              span.addEvent('business_error', {
                'error.message': res.error,
                ...(res.code ? { 'error.code': res.code } : {}),
              });
            }
          }
          return result;
        } catch (err) {
          span.recordException(err);
          throw err;
        }
      },
    );
  });
}
