import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app, type BrowserWindow, type Display, screen } from 'electron';

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

export const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1024,
  height: 768,
  isMaximized: false,
};

/**
 * 校验并矫正窗口状态，防止外接显示器断开后坐标飞出屏幕可见区域
 */
export function validateWindowState(
  state: Partial<WindowState> | null | undefined,
  displays: Display[],
): WindowState {
  const width = Math.max(state?.width ?? DEFAULT_WINDOW_STATE.width, 400);
  const height = Math.max(state?.height ?? DEFAULT_WINDOW_STATE.height, 300);
  const isMaximized = Boolean(state?.isMaximized);

  if (state?.x === undefined || state?.y === undefined || displays.length === 0) {
    return { width, height, isMaximized };
  }

  const { x, y } = state;

  // 检查窗口至少有部分标题栏处于某个显示器的有效工作区内
  const isVisibleOnAnyDisplay = displays.some((display) => {
    const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
    // 窗口左上角或右上角在显示器内部，且标题栏 y 轴可见
    return x >= dx - 50 && x < dx + dw - 50 && y >= dy - 10 && y < dy + dh - 50;
  });

  if (isVisibleOnAnyDisplay) {
    return { x, y, width, height, isMaximized };
  }

  // 越界则清除坐标，由 Electron 默认居中显示在主显示器
  return { width, height, isMaximized };
}

export class WindowStateKeeper {
  readonly #stateFilePath: string;
  #state: WindowState;
  #saveTimer: NodeJS.Timeout | null = null;

  constructor(customPath?: string) {
    const dir = customPath ?? (app ? app.getPath('userData') : os.tmpdir());
    this.#stateFilePath = path.join(dir, 'window-state.json');
    this.#state = this.loadState();
  }

  public getState(): WindowState {
    if (app?.isReady()) {
      this.validateWithDisplays();
    }
    return { ...this.#state };
  }

  /**
   * 在 app.whenReady() 触发后安全校验多显示器可见性
   */
  public validateWithDisplays(): WindowState {
    if (app?.isReady() && screen?.getAllDisplays) {
      try {
        const displays = screen.getAllDisplays();
        if (displays.length > 0) {
          this.#state = validateWindowState(this.#state, displays);
        }
      } catch {
        // screen getAllDisplays safety fallback
      }
    }
    return { ...this.#state };
  }

  public loadState(): WindowState {
    try {
      if (fs.existsSync(this.#stateFilePath)) {
        const raw = fs.readFileSync(this.#stateFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (app?.isReady() && screen?.getAllDisplays) {
          try {
            const displays = screen.getAllDisplays();
            if (displays.length > 0) {
              return validateWindowState(parsed, displays);
            }
          } catch {
            // screen not ready yet
          }
        }
        // 冷启动 screen 尚未就绪时，安全保留已存储的尺寸与坐标，不调用 screen.getAllDisplays()
        return {
          width: Math.max(parsed?.width ?? DEFAULT_WINDOW_STATE.width, 400),
          height: Math.max(parsed?.height ?? DEFAULT_WINDOW_STATE.height, 300),
          isMaximized: Boolean(parsed?.isMaximized),
          ...(typeof parsed?.x === 'number' ? { x: parsed.x } : {}),
          ...(typeof parsed?.y === 'number' ? { y: parsed.y } : {}),
        };
      }
    } catch {
      // 文件损坏或读取失败时静默回退默认值
    }
    return { ...DEFAULT_WINDOW_STATE };
  }

  public saveStateSync(): void {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }
    try {
      const dir = path.dirname(this.#stateFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.#stateFilePath, JSON.stringify(this.#state, null, 2), 'utf-8');
    } catch {
      // 写入失败降级处理
    }
  }

  public scheduleSave(): void {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
    }
    this.#saveTimer = setTimeout(() => {
      this.saveStateSync();
    }, 500);
  }

  public track(browserWindow: BrowserWindow): void {
    const updateBounds = () => {
      if (browserWindow.isDestroyed()) return;
      if (!browserWindow.isMaximized() && !browserWindow.isMinimized()) {
        const bounds = browserWindow.getBounds();
        this.#state = {
          ...this.#state,
          ...bounds,
          isMaximized: false,
        };
        this.scheduleSave();
      }
    };

    browserWindow.on('resize', updateBounds);
    browserWindow.on('move', updateBounds);

    browserWindow.on('maximize', () => {
      this.#state.isMaximized = true;
      this.scheduleSave();
    });

    browserWindow.on('unmaximize', () => {
      this.#state.isMaximized = false;
      this.scheduleSave();
    });

    browserWindow.on('close', () => {
      if (!browserWindow.isDestroyed() && !browserWindow.isMaximized()) {
        const bounds = browserWindow.getBounds();
        this.#state = {
          ...this.#state,
          ...bounds,
        };
      }
      this.saveStateSync();
    });
  }
}
