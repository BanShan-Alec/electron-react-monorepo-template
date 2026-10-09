import { EventEmitter } from 'node:events';
import { getTracer } from '@app/main/telemetry/tracer';
import { trackWindowLifecycle } from '@app/main/telemetry/window-tracer';
import type { SpanRecord } from '@app/shared/types/telemetry';
import { describe, expect, it } from 'vitest';

class MockWebContents extends EventEmitter {
  public isDestroyed() {
    return false;
  }
}

class MockBrowserWindow extends EventEmitter {
  public id = 101;
  public webContents = new MockWebContents();
  public isDestroyed() {
    return false;
  }
}

describe('Window Tracer', () => {
  it('tracks window lifecycle events and emits dual spans', () => {
    const tracer = getTracer();
    const records: SpanRecord[] = [];
    const unsubscribe = tracer.onSpanEnd((record) => {
      records.push(record);
    });

    const mockWin = new MockBrowserWindow() as unknown as Electron.BrowserWindow;
    trackWindowLifecycle('home', mockWin);

    // 触发 dom-ready on webContents
    mockWin.webContents.emit('dom-ready');

    // 触发 ready-to-show：此时应立即落盘 window.initialization Span
    mockWin.emit('ready-to-show');

    expect(records).toHaveLength(1);
    const initRecord = records[0];
    expect(initRecord.name).toBe('window.initialization');
    expect(initRecord.attributes['window.name']).toBe('home');
    expect(initRecord.attributes['window.id']).toBe(101);
    expect(initRecord.events.map((e) => e.name)).toEqual([
      'window.created',
      'window.dom_ready',
      'window.ready_to_show',
    ]);
    expect(initRecord.status).toBe('OK');

    // 触发 closed：此时应落盘 window.lifecycle Span 并解绑监听
    mockWin.emit('closed');

    expect(records).toHaveLength(2);
    const lifecycleRecord = records[1];
    expect(lifecycleRecord.name).toBe('window.lifecycle');
    expect(lifecycleRecord.attributes['window.name']).toBe('home');
    expect(lifecycleRecord.attributes['window.id']).toBe(101);
    expect(lifecycleRecord.events.map((e) => e.name)).toEqual([
      'window.created',
      'window.dom_ready',
      'window.ready_to_show',
      'window.closed',
    ]);
    expect(lifecycleRecord.status).toBe('OK');

    // 验证监听器已被注销，防止内存泄漏
    expect(mockWin.webContents.listenerCount('dom-ready')).toBe(0);
    expect(mockWin.listenerCount('ready-to-show')).toBe(0);
    expect(mockWin.listenerCount('closed')).toBe(0);

    unsubscribe();
  });
});
