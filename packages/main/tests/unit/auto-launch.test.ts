import { HomeWindowModule } from '@app/main/modules/window/home-window.module';
import { AutoLaunchService } from '@app/main/services/auto-launch.service';
import { ConfigService } from '@app/main/services/config.service';
import { app } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getLoginItemSettings: vi.fn(),
    setLoginItemSettings: vi.fn(),
  },
}));

vi.mock('@app/main/env', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isPackaged: true,
  currentAppEnv: 'production',
  isTest: true,
}));

vi.mock('@app/main/modules/log.module', () => ({
  getLogManager: () => ({
    scoped: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  }),
}));

const mockStore = {
  get: vi.fn(),
  set: vi.fn(),
  getAll: vi.fn(),
  reset: vi.fn(),
};

vi.mock('@app/main/modules/config.module', () => ({
  getAppConfigStore: () => mockStore,
}));

vi.mock('@app/main/modules/native-theme.module', () => ({
  applyNativeThemeSource: vi.fn(),
}));

vi.mock('@app/main/modules/tray.module', () => ({
  getTrayManager: () => ({
    updateLanguage: vi.fn(),
  }),
}));

const originalPlatform = process.platform;

// 断言以 Windows 分支行为为基准；CI 跑在 Linux，不锁定平台会导致 args 分支断言不一致
beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'win32' });
});

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform });
});

describe('AutoLaunchService', () => {
  let service: AutoLaunchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AutoLaunchService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls app.setLoginItemSettings with --hidden args when openAtLogin is true in packaged mode', () => {
    service.setOpenAtLogin(true);

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      args: ['--hidden'],
    });
  });

  it('calls app.setLoginItemSettings with empty args when openAtLogin is false in packaged mode', () => {
    service.setOpenAtLogin(false);

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: false,
      args: [],
    });
  });

  it('throws an error if app.setLoginItemSettings throws', () => {
    vi.mocked(app.setLoginItemSettings).mockImplementationOnce(() => {
      throw new Error('Access denied by OS policy');
    });

    expect(() => service.setOpenAtLogin(true)).toThrow(
      'Failed to update system login item settings: Access denied by OS policy',
    );
  });

  it('detects isBlockedBySystem when config is enabled but executableWillLaunchAtLogin is false on win32', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    try {
      mockStore.get.mockReturnValue(true);
      vi.mocked(app.getLoginItemSettings).mockReturnValue({
        openAtLogin: true,
        executableWillLaunchAtLogin: false,
        wasOpenedAtLogin: false,
        status: 'enabled',
        launchItems: [],
      });

      const status = service.getLoginItemStatus();
      expect(status.openAtLogin).toBe(true);
      expect(status.isBlockedBySystem).toBe(true);
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('returns isBlockedBySystem false when settings match config', () => {
    mockStore.get.mockReturnValue(true);
    vi.mocked(app.getLoginItemSettings).mockReturnValue({
      openAtLogin: true,
      executableWillLaunchAtLogin: true,
      wasOpenedAtLogin: false,
      status: 'enabled',
      launchItems: [],
    });

    const status = service.getLoginItemStatus();
    expect(status.openAtLogin).toBe(true);
    expect(status.isBlockedBySystem).toBe(false);
  });

  it('mirrors config and skips OS query on unsupported platforms (linux)', () => {
    const savedPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    try {
      mockStore.get.mockReturnValue(true);

      const status = service.getLoginItemStatus();
      expect(status).toEqual({ openAtLogin: true, isBlockedBySystem: false });
      // 不应虚构 OS 状态，也不应触发系统调用
      expect(app.getLoginItemSettings).not.toHaveBeenCalled();

      service.setOpenAtLogin(true);
      expect(app.setLoginItemSettings).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, 'platform', { value: savedPlatform });
    }
  });

  it('flags isBlockedBySystem when config is enabled but the startup item is gone', () => {
    mockStore.get.mockReturnValue(true);
    vi.mocked(app.getLoginItemSettings).mockReturnValue({
      openAtLogin: false,
      executableWillLaunchAtLogin: true,
      wasOpenedAtLogin: false,
      status: 'enabled',
      launchItems: [],
    });

    const status = service.getLoginItemStatus();
    expect(status.isBlockedBySystem).toBe(true);
  });

  it('does not flag a mismatch when config is disabled', () => {
    mockStore.get.mockReturnValue(false);
    vi.mocked(app.getLoginItemSettings).mockReturnValue({
      openAtLogin: false,
      executableWillLaunchAtLogin: false,
      wasOpenedAtLogin: false,
      status: 'enabled',
      launchItems: [],
    });

    const status = service.getLoginItemStatus();
    expect(status.isBlockedBySystem).toBe(false);
  });

  it('checkStartupStatus queries the OS once and leaves warning output to getLoginItemStatus', () => {
    mockStore.get.mockReturnValue(true);
    vi.mocked(app.getLoginItemSettings).mockReturnValue({
      openAtLogin: false,
      executableWillLaunchAtLogin: false,
      wasOpenedAtLogin: false,
      status: 'enabled',
      launchItems: [],
    });
    const getStatusSpy = vi.spyOn(service, 'getLoginItemStatus');

    service.checkStartupStatus(true);

    expect(getStatusSpy).toHaveBeenCalledTimes(1);
    expect(getStatusSpy).toHaveBeenCalledWith(true);
    // 告警由 getLoginItemStatus 内部单点产出，调用方不再重复查一次
    expect(app.getLoginItemSettings).toHaveBeenCalledTimes(1);
  });
});

describe('ConfigService with AutoLaunch', () => {
  let configService: ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    configService = new ConfigService();
  });

  it('calls setLoginItemSettings when updating openAtLogin', () => {
    mockStore.set.mockReturnValue({ openAtLogin: true });

    configService.updateConfig({ openAtLogin: true });

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      args: ['--hidden'],
    });
    expect(mockStore.set).toHaveBeenCalledWith({ openAtLogin: true });
  });

  it('calls setLoginItemSettings to disable auto launch on resetConfig', () => {
    mockStore.reset.mockReturnValue({
      theme: 'system',
      language: 'system',
      openAtLogin: false,
    });

    configService.resetConfig();

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: false,
      args: [],
    });
    expect(mockStore.reset).toHaveBeenCalled();
  });

  it('still resets config when clearing the OS login item fails', () => {
    vi.mocked(app.setLoginItemSettings).mockImplementationOnce(() => {
      throw new Error('Access denied by OS policy');
    });
    mockStore.reset.mockReturnValue({
      theme: 'system',
      language: 'system',
      openAtLogin: false,
    });

    // 系统调用失败只降级告警，不能阻断配置/主题/托盘的恢复
    expect(() => configService.resetConfig()).not.toThrow();
    expect(mockStore.reset).toHaveBeenCalled();
  });
});

describe('HomeWindowModule startup visibility', () => {
  it('creates and shows window when --hidden is present but minimizeToTray is false', async () => {
    const originalArgv = process.argv;
    process.argv = [...originalArgv, '--hidden'];
    mockStore.get.mockImplementation((key) => {
      if (key === 'minimizeToTray') return false;
      return undefined;
    });

    const mockApp = {
      whenReady: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      getLoginItemSettings: vi.fn().mockReturnValue({ wasOpenedAtLogin: false }),
    } as unknown as Electron.App;

    const module = new HomeWindowModule({
      initConfig: {
        preload: { path: '' },
        windows: {
          home: new URL('http://localhost'),
          updater: new URL('http://localhost'),
        },
      },
    });

    const restoreSpy = vi.spyOn(module, 'restoreOrCreateWindow').mockResolvedValue({} as never);

    try {
      await module.enable({ app: mockApp });
      expect(restoreSpy).toHaveBeenCalledWith(true);
    } finally {
      process.argv = originalArgv;
    }
  });

  it('starts hidden on macOS when the process was launched by the login item', async () => {
    const savedPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    mockStore.get.mockImplementation((key) => {
      if (key === 'minimizeToTray') return true;
      return undefined;
    });

    // macOS 无法通过 args 传参，登录启动只能靠系统标记识别
    const mockApp = {
      whenReady: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      getLoginItemSettings: vi.fn().mockReturnValue({ wasOpenedAtLogin: true }),
    } as unknown as Electron.App;

    const module = new HomeWindowModule({
      initConfig: {
        preload: { path: '' },
        windows: {
          home: new URL('http://localhost'),
          updater: new URL('http://localhost'),
        },
      },
    });

    const restoreSpy = vi.spyOn(module, 'restoreOrCreateWindow').mockResolvedValue({} as never);

    try {
      await module.enable({ app: mockApp });
      expect(restoreSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, 'platform', { value: savedPlatform });
    }
  });

  it('shows the window on macOS login launch when minimizeToTray is false', async () => {
    const savedPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    mockStore.get.mockImplementation((key) => {
      if (key === 'minimizeToTray') return false;
      return undefined;
    });

    const mockApp = {
      whenReady: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      getLoginItemSettings: vi.fn().mockReturnValue({ wasOpenedAtLogin: true }),
    } as unknown as Electron.App;

    const module = new HomeWindowModule({
      initConfig: {
        preload: { path: '' },
        windows: {
          home: new URL('http://localhost'),
          updater: new URL('http://localhost'),
        },
      },
    });

    const restoreSpy = vi.spyOn(module, 'restoreOrCreateWindow').mockResolvedValue({} as never);

    try {
      await module.enable({ app: mockApp });
      expect(restoreSpy).toHaveBeenCalledWith(true);
    } finally {
      Object.defineProperty(process, 'platform', { value: savedPlatform });
    }
  });

  it('keeps window hidden when --hidden is present and minimizeToTray is true', async () => {
    const originalArgv = process.argv;
    process.argv = [...originalArgv, '--hidden'];
    mockStore.get.mockImplementation((key) => {
      if (key === 'minimizeToTray') return true;
      return undefined;
    });

    const mockApp = {
      whenReady: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      getLoginItemSettings: vi.fn().mockReturnValue({ wasOpenedAtLogin: false }),
    } as unknown as Electron.App;

    const module = new HomeWindowModule({
      initConfig: {
        preload: { path: '' },
        windows: {
          home: new URL('http://localhost'),
          updater: new URL('http://localhost'),
        },
      },
    });

    const restoreSpy = vi.spyOn(module, 'restoreOrCreateWindow').mockResolvedValue({} as never);

    try {
      await module.enable({ app: mockApp });
      expect(restoreSpy).not.toHaveBeenCalled();
    } finally {
      process.argv = originalArgv;
    }
  });
});
