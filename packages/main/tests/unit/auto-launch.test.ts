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
  // 默认以安装版副本为基准；免安装副本场景在用例内部通过构造函数注入覆盖
  isInstalledCopy: () => true,
  // 构建期仓库标识存在，避免用例触发「无法判定副本形态」的告警分支
  hasBuildRepoRoot: true,
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

  it('calls app.setLoginItemSettings with --hidden args when autoLaunch is true in packaged mode', () => {
    service.setAutoLaunch(true);

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      args: ['--hidden'],
    });
  });

  it('calls app.setLoginItemSettings with empty args when autoLaunch is false in packaged mode', () => {
    service.setAutoLaunch(false);

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: false,
      args: [],
    });
  });

  it('throws an error if app.setLoginItemSettings throws', () => {
    vi.mocked(app.setLoginItemSettings).mockImplementationOnce(() => {
      throw new Error('Access denied by OS policy');
    });

    expect(() => service.setAutoLaunch(true)).toThrow(
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

      const status = service.getAutoLaunchStatus();
      expect(status.isSupported).toBe(true);
      expect(status.isEnabled).toBe(true);
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

    const status = service.getAutoLaunchStatus();
    expect(status.isSupported).toBe(true);
    expect(status.isEnabled).toBe(true);
    expect(status.isBlockedBySystem).toBe(false);
  });

  it('mirrors config and skips OS query on unsupported platforms (linux)', () => {
    const savedPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    try {
      mockStore.get.mockReturnValue(true);

      const status = service.getAutoLaunchStatus();
      expect(status).toEqual({
        isSupported: false,
        isEnabled: true,
        isBlockedBySystem: false,
        unsupportedReason: 'platform',
      });
      // 不应虚构 OS 状态，也不应触发系统调用
      expect(app.getLoginItemSettings).not.toHaveBeenCalled();

      service.setAutoLaunch(true);
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

    const status = service.getAutoLaunchStatus();
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

    const status = service.getAutoLaunchStatus();
    expect(status.isBlockedBySystem).toBe(false);
  });

  it('checkStartupStatus queries the OS once and leaves warning output to getAutoLaunchStatus', () => {
    mockStore.get.mockReturnValue(true);
    vi.mocked(app.getLoginItemSettings).mockReturnValue({
      openAtLogin: false,
      executableWillLaunchAtLogin: false,
      wasOpenedAtLogin: false,
      status: 'enabled',
      launchItems: [],
    });
    const getStatusSpy = vi.spyOn(service, 'getAutoLaunchStatus');

    service.checkStartupStatus(true);

    expect(getStatusSpy).toHaveBeenCalledTimes(1);
    expect(getStatusSpy).toHaveBeenCalledWith(true);
    // 告警由 getAutoLaunchStatus 内部单点产出，调用方不再重复查一次
    expect(app.getLoginItemSettings).toHaveBeenCalledTimes(1);
  });
});

describe('AutoLaunchService 收权：仅安装版副本可管理系统登录项', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createUnpackedCopyService(): AutoLaunchService {
    return new AutoLaunchService({
      isPlatformSupported: () => true,
      isInstalledCopy: () => false,
    });
  }

  it('免安装副本写入被降级为无操作，不触碰安装版共用启动项', () => {
    const service = createUnpackedCopyService();

    service.setAutoLaunch(true);

    expect(app.setLoginItemSettings).not.toHaveBeenCalled();
  });

  it('免安装副本清除自启也是无操作，不会误删安装版启动项', () => {
    const service = createUnpackedCopyService();

    service.setAutoLaunch(false);

    expect(app.setLoginItemSettings).not.toHaveBeenCalled();
  });

  it('免安装副本上报 unsupportedReason=unpacked-copy 且不查询系统状态', () => {
    mockStore.get.mockReturnValue(true);
    const service = createUnpackedCopyService();

    const status = service.getAutoLaunchStatus();

    expect(status).toEqual({
      isSupported: false,
      isEnabled: true,
      isBlockedBySystem: false,
      unsupportedReason: 'unpacked-copy',
    });
    expect(app.getLoginItemSettings).not.toHaveBeenCalled();
  });

  it('免安装副本启动静默校验直接跳过，不告警也不查系统', () => {
    mockStore.get.mockReturnValue(true);
    const service = createUnpackedCopyService();

    service.checkStartupStatus(true);

    expect(app.getLoginItemSettings).not.toHaveBeenCalled();
  });

  it('安装版副本保持原有写入行为', () => {
    const service = new AutoLaunchService({
      isPlatformSupported: () => true,
      isInstalledCopy: () => true,
    });

    service.setAutoLaunch(true);

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      args: ['--hidden'],
    });
  });

  it('源码运行态（未打包）上报 source-run，不误标为免安装副本', () => {
    mockStore.get.mockReturnValue(true);
    const service = new AutoLaunchService({
      isPlatformSupported: () => true,
      isPackaged: () => false,
      isInstalledCopy: () => false,
    });

    const status = service.getAutoLaunchStatus();

    expect(status.isSupported).toBe(false);
    expect(status.unsupportedReason).toBe('source-run');
  });
});

describe('ConfigService with AutoLaunch', () => {
  let configService: ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    configService = new ConfigService();
  });

  it('calls setLoginItemSettings when updating autoLaunch', () => {
    mockStore.set.mockReturnValue({ autoLaunch: true });

    configService.updateConfig({ autoLaunch: true });

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      args: ['--hidden'],
    });
    expect(mockStore.set).toHaveBeenCalledWith({ autoLaunch: true });
  });

  it('calls setLoginItemSettings to disable auto launch on resetConfig', () => {
    mockStore.reset.mockReturnValue({
      theme: 'system',
      language: 'system',
      autoLaunch: false,
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
      autoLaunch: false,
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
