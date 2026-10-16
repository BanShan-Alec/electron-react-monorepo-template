import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app, type BrowserWindow, type Display, screen } from 'electron';
import {
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  resolveWindowBounds,
} from './window-size';

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

export const DEFAULT_WINDOW_STATE: WindowState = {
  width: DEFAULT_WINDOW_WIDTH,
  height: DEFAULT_WINDOW_HEIGHT,
  isMaximized: false,
};

/**
 * 校验并矫正窗口状态，基于目标显示器有效工作区进行边界截断与超屏重置
 */
export function validateWindowState(
  state: Partial<WindowState> | null | undefined,
  displays: Display[],
): WindowState {
  if (!displays || displays.length === 0) {
    return {
      width: Math.max(state?.width ?? DEFAULT_WINDOW_WIDTH, MIN_WINDOW_WIDTH),
      height: Math.max(state?.height ?? DEFAULT_WINDOW_HEIGHT, MIN_WINDOW_HEIGHT),
      isMaximized: Boolean(state?.isMaximized),
      ...(typeof state?.x === 'number' ? { x: state.x } : {}),
      ...(typeof state?.y === 'number' ? { y: state.y } : {}),
    };
  }

  // 寻找与当前坐标最匹配的目标显示器，若无匹配则使用主屏或首选显示器
  const targetDisplay =
    displays.find((display) => {
      if (typeof state?.x !== 'number' || typeof state?.y !== 'number') return false;
      const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
      return (
        state.x >= dx - 50 && state.x < dx + dw - 50 && state.y >= dy - 10 && state.y < dy + dh - 50
      );
    }) ?? displays[0];

  return resolveWindowBounds(state, targetDisplay);
}

export class WindowStateKeeper {
  private readonly stateFilePath: string;
  private state: WindowState;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(customPath?: string) {
    const dir = customPath ?? (app ? app.getPath('userData') : os.tmpdir());
    this.stateFilePath = path.join(dir, 'window-state.json');
    this.state = this.loadState();
  }

  public getState(): WindowState {
    if (app?.isReady()) {
      this.validateWithDisplays();
    }
    return { ...this.state };
  }

  /**
   * 在 app.whenReady() 触发后安全校验多显示器可见性
   */
  public validateWithDisplays(): WindowState {
    if (app?.isReady() && screen?.getAllDisplays) {
      try {
        const displays = screen.getAllDisplays();
        if (displays.length > 0) {
          this.state = validateWindowState(this.state, displays);
        }
      } catch {
        // screen getAllDisplays safety fallback
      }
    }
    return { ...this.state };
  }

  public loadState(): WindowState {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = fs.readFileSync(this.stateFilePath, 'utf-8');
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
          width: Math.max(parsed?.width ?? DEFAULT_WINDOW_STATE.width, MIN_WINDOW_WIDTH),
          height: Math.max(parsed?.height ?? DEFAULT_WINDOW_STATE.height, MIN_WINDOW_HEIGHT),
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
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    try {
      const dir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.stateFilePath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch {
      // 写入失败降级处理
    }
  }

  public scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    // 250ms 防抖（参考 ZCode/VS Code），过滤拖拽缩放时的高频渲染帧 I/O
    this.saveTimer = setTimeout(() => {
      this.saveStateSync();
    }, 250);
  }

  public track(browserWindow: BrowserWindow): void {
    const updateBounds = () => {
      if (browserWindow.isDestroyed()) return;
      // 关键隔离：最大化窗口的当前 bounds 等于显示器工作区，
      // 始终读取 normal bounds，防止最大化尺寸污染常规窗口大小
      const bounds = browserWindow.getNormalBounds();
      this.state = {
        ...this.state,
        ...bounds,
        isMaximized: browserWindow.isMaximized(),
      };
      this.scheduleSave();
    };

    browserWindow.on('resize', updateBounds);
    browserWindow.on('move', updateBounds);

    browserWindow.on('maximize', () => {
      this.state.isMaximized = true;
      this.saveStateSync();
    });

    browserWindow.on('unmaximize', () => {
      this.state.isMaximized = false;
      this.saveStateSync();
    });

    browserWindow.on('close', () => {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      if (!browserWindow.isDestroyed()) {
        const bounds = browserWindow.getNormalBounds();
        this.state = {
          ...this.state,
          ...bounds,
          isMaximized: browserWindow.isMaximized(),
        };
      }
      this.saveStateSync();
    });
  }
}
