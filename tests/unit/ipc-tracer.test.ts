import { describe, expect, it } from 'vitest';
import { isTracedIpcPayload } from '../../packages/main/src/telemetry/ipc-tracer';
import { getTracer } from '../../packages/main/src/telemetry/tracer';
import type { TracedIpcPayload } from '../../packages/shared/types/telemetry';

describe('IPC Tracer Contract', () => {
  it('correctly detects TracedIpcPayload', () => {
    const validPayload: TracedIpcPayload<{ num: number }> = {
      __trace_carrier: {
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
      data: { num: 42 },
    };

    expect(isTracedIpcPayload(validPayload)).toBe(true);
    expect(isTracedIpcPayload({ data: 42 })).toBe(false);
    expect(isTracedIpcPayload(null)).toBe(false);
    expect(isTracedIpcPayload('string')).toBe(false);
    expect(isTracedIpcPayload(undefined)).toBe(false);
  });

  it('extracts parentContext from carrier and maintains causal link', async () => {
    const tracer = getTracer();
    const parentTraceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const clientSpanId = '00f067aa0ba902b7';
    const traceparent = `00-${parentTraceId}-${clientSpanId}-01`;

    const payload: TracedIpcPayload<string> = {
      __trace_carrier: { traceparent },
      data: 'test-data',
    };

    let capturedTraceId: string | undefined;
    let capturedParentId: string | undefined;

    const parentContext = tracer.extract(
      payload.__trace_carrier as Record<string, string | undefined>,
    );

    await tracer.startActiveSpan('ipc.receive:test', { parentContext }, async (_span) => {
      const active = tracer.getActiveContext();
      capturedTraceId = active?.traceId;
      capturedParentId = active?.parentSpanId;
    });

    // 因果关系验证：主进程内部操作的 parent_id 必须严格等于 IPC 传入的客户端 span_id
    expect(capturedTraceId).toBe(parentTraceId);
    expect(capturedParentId).toBe(clientSpanId);
  });

  it('falls back gracefully to new traceId when carrier is missing', async () => {
    const tracer = getTracer();
    let capturedTraceId: string | undefined;
    let capturedParentId: string | undefined;

    await tracer.startActiveSpan('ipc.receive:untraced', { parentContext: undefined }, async () => {
      const active = tracer.getActiveContext();
      capturedTraceId = active?.traceId;
      capturedParentId = active?.parentSpanId;
    });

    expect(capturedTraceId).toBeDefined();
    expect(capturedTraceId).toMatch(/^[0-9a-f]{32}$/);
    expect(capturedParentId).toBeUndefined();
  });
});
