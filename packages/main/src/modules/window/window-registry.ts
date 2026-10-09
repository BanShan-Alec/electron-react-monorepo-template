import type { WindowId } from '@app/shared/constants/windows';
import type { BrowserWindow } from 'electron';
import { trackWindowLifecycle } from '../../telemetry/window-tracer';

const registry = new Map<WindowId, BrowserWindow>();

export function registerWindow(id: WindowId, win: BrowserWindow): void {
  registry.set(id, win);
  trackWindowLifecycle(id, win);
  win.on('closed', () => {
    // 按实例注销，防止旧引用覆盖新实例
    if (registry.get(id) === win) {
      registry.delete(id);
    }
  });
}

export function forgetWindow(id: WindowId, win?: BrowserWindow): void {
  if (win) {
    if (registry.get(id) === win) {
      registry.delete(id);
    }
  } else {
    registry.delete(id);
  }
}

export function getWindow(id: WindowId): BrowserWindow | undefined {
  const win = registry.get(id);
  if (win && !win.isDestroyed()) {
    return win;
  }
  return undefined;
}

export function getWindowName(win: BrowserWindow): WindowId | undefined {
  for (const [id, w] of registry) {
    if (w === win) {
      return id;
    }
  }
  return undefined;
}

export function sendToWindow(id: WindowId, channel: string, payload: unknown): boolean {
  const win = getWindow(id);
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
    return true;
  }
  return false;
}

export function broadcast(channel: string, payload: unknown): void {
  for (const [, win] of registry) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}
