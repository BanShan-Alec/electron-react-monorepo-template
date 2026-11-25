import { EventEmitter } from 'node:events';
import { AppError } from '@app/main/errors/AppError';
import { UpdaterService, type UpdaterServiceDeps } from '@app/main/services/updater.service';
import { ErrorCode } from '@app/shared/constants/error-codes';
import type { AppUpdater } from 'electron-updater';
import { describe, expect, it, vi } from 'vitest';

// electron 在 Vitest node 环境下不可用（导出为二进制路径字符串）：按外部协作方 mock。
// 本 PR 让快照出口注入 currentVersion（app.getVersion），取消分支还会读托盘偏好决定是否 app.quit
vi.mock('electron', () => {
  return {
    app: {
      getVersion: () => '1.14.0',
      getName: () => 'Electron React Template',
      isPackaged: false,
      quit: vi.fn(),
    },
    Notification: Object.assign(
      class MockNotification {
        on() {
          return this;
        }
        show() {}
      },
      { isSupported: () => false },
    ),
  };
});

// 取消分支会读取托盘偏好决定是否退出：mock 为 true 避免单测触发 app.quit / 真实落盘
vi.mock('@app/main/modules/config.module', () => {
  return {
    getAppConfigStore: () => ({
      get: (key: string) => (key === 'minimizeToTray' ? true : undefined),
      set: vi.fn(),
    }),
  };
});

const TEST_REPOSITORY = { owner: 'test-owner', repo: 'test-repo' } as const;

function createService(updater: AppUpdater, overrides: UpdaterServiceDeps = {}): UpdaterService {
  return new UpdaterService({ updater, repository: TEST_REPOSITORY, ...overrides });
}

function createMockUpdater(overrides?: {
  checkForUpdates?: () => Promise<unknown>;
  // 传入 token 以便模拟「取消后 reject」的真实 electron-updater 行为
  downloadUpdate?: (token?: unknown) => Promise<unknown>;
}): AppUpdater {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    checkForUpdates: overrides?.checkForUpdates ?? vi.fn().mockResolvedValue(null),
    downloadUpdate: overrides?.downloadUpdate ?? vi.fn().mockResolvedValue([]),
    setFeedURL: vi.fn(),
  }) as unknown as AppUpdater;
}

describe('UpdaterService error classification through public API', () => {
  it('adopts the code of a tagged AppError on check failure', async () => {
    const timeout = new AppError(
      '检查更新请求超时（15 秒），请检查网络连接后重试',
      ErrorCode.UPDATER_NETWORK_ERROR,
    );
    const mockUpdater = createMockUpdater({
      checkForUpdates: vi.fn().mockRejectedValue(timeout),
    });

    const service = createService(mockUpdater);

    await expect(service.check()).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.UPDATER_NETWORK_ERROR);
      return true;
    });

    const snapshot = service.getSnapshot();
    expect(snapshot.state).toBe('error');
    expect(snapshot.code).toBe(ErrorCode.UPDATER_NETWORK_ERROR);
  });

  it('classifies electron-updater network failures by net::ERR_ prefix', async () => {
    const netErr = new Error('Error: net::ERR_CONNECTION_TIMED_OUT');
    const mockUpdater = createMockUpdater({
      checkForUpdates: vi.fn().mockRejectedValue(netErr),
    });

    const service = createService(mockUpdater);

    await expect(service.check()).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.UPDATER_NETWORK_ERROR);
      return true;
    });

    const snapshot = service.getSnapshot();
    expect(snapshot.state).toBe('error');
    expect(snapshot.code).toBe(ErrorCode.UPDATER_NETWORK_ERROR);
  });

  it('falls back to UPDATER_CHECK_FAILED for unclassified check errors', async () => {
    const unclassified = new Error('ENOENT: no such file');
    const mockUpdater = createMockUpdater({
      checkForUpdates: vi.fn().mockRejectedValue(unclassified),
    });

    const service = createService(mockUpdater);

    await expect(service.check()).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.UPDATER_CHECK_FAILED);
      return true;
    });

    const snapshot = service.getSnapshot();
    expect(snapshot.state).toBe('error');
    expect(snapshot.code).toBe(ErrorCode.UPDATER_CHECK_FAILED);
  });

  it('handles non-Error throwables via fallback code', async () => {
    const mockUpdater = createMockUpdater({
      checkForUpdates: vi.fn().mockRejectedValue('raw string failure'),
    });

    const service = createService(mockUpdater);

    await expect(service.check()).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.UPDATER_CHECK_FAILED);
      return true;
    });

    const snapshot = service.getSnapshot();
    expect(snapshot.state).toBe('error');
    expect(snapshot.code).toBe(ErrorCode.UPDATER_CHECK_FAILED);
  });

  it('classifies download failures through download() interface', async () => {
    const downloadErr = new Error('sha256 checksum mismatch');
    const mockUpdater = createMockUpdater({
      downloadUpdate: vi.fn().mockRejectedValue(downloadErr),
    });

    const service = createService(mockUpdater);
    service.mockEmit({ type: 'available', version: '2.0.0' });

    await expect(service.download()).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.UPDATER_DOWNLOAD_FAILED);
      return true;
    });

    const snapshot = service.getSnapshot();
    expect(snapshot.state).toBe('error');
    expect(snapshot.code).toBe(ErrorCode.UPDATER_DOWNLOAD_FAILED);
  });
});

describe('UpdaterService publish feed resolution', () => {
  const repository = { owner: 'BanShan-Alec', repo: 'electron-react-monorepo-template' };

  it('falls back to bundled repository feed when packaged build ships without app-update.yml', () => {
    const mockUpdater = createMockUpdater();

    new UpdaterService({
      updater: mockUpdater,
      isPackaged: () => true,
      hasAppUpdateConfig: () => false,
      repository,
    });

    expect(mockUpdater.setFeedURL).toHaveBeenCalledWith({ provider: 'github', ...repository });
  });

  it('keeps app-update.yml publish config when the packaged build ships the file', () => {
    const mockUpdater = createMockUpdater();

    new UpdaterService({
      updater: mockUpdater,
      isPackaged: () => true,
      hasAppUpdateConfig: () => true,
      repository,
    });

    expect(mockUpdater.setFeedURL).not.toHaveBeenCalled();
  });

  it('runs the check through the fallback feed instead of failing on a missing app-update.yml', async () => {
    const checkForUpdates = vi.fn().mockResolvedValue(null);
    const service = createService(createMockUpdater({ checkForUpdates }), {
      isPackaged: () => true,
      hasAppUpdateConfig: () => false,
    });

    await service.check();

    expect(checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('rejects with UPDATER_NOT_CONFIGURED when both app-update.yml and repository.url are missing', async () => {
    const checkForUpdates = vi.fn().mockResolvedValue(null);
    const service = new UpdaterService({
      updater: createMockUpdater({ checkForUpdates }),
      isPackaged: () => true,
      hasAppUpdateConfig: () => false,
      repository: { owner: '', repo: '' },
    });

    await expect(service.check()).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.UPDATER_NOT_CONFIGURED);
      return true;
    });

    expect(checkForUpdates).not.toHaveBeenCalled();
    const snapshot = service.getSnapshot();
    expect(snapshot.state).toBe('error');
    expect(snapshot.code).toBe(ErrorCode.UPDATER_NOT_CONFIGURED);
  });
});

describe('UpdaterService snapshot contract and cancelled state machine', () => {
  it('injects currentVersion into every snapshot returned by getSnapshot()', () => {
    const service = createService(createMockUpdater());

    const snapshot = service.getSnapshot();

    expect(snapshot.currentVersion).toBeTruthy();
  });

  it('transitions downloading to cancelled on cancel() and keeps version metadata', async () => {
    const service = createService(createMockUpdater());
    service.mockEmit({ type: 'available', version: '2.0.0' });
    service.mockEmit({ type: 'progress', percent: 40 });

    await service.cancel();

    const snapshot = service.getSnapshot();
    expect(snapshot.state).toBe('cancelled');
    expect(snapshot.version).toBe('2.0.0');
    expect(snapshot.progress).toBeNull();
    expect(snapshot.error).toBeNull();
    expect(snapshot.code).toBeNull();
  });

  it('mockEmit cancelled keeps current mock metadata', () => {
    const service = createService(createMockUpdater());
    service.mockEmit({ type: 'available', version: '2.0.0', releaseNotes: ['note'] });
    service.mockEmit({ type: 'progress', percent: 60 });

    service.mockEmit({ type: 'cancelled' });

    const snapshot = service.getSnapshot();
    expect(snapshot.state).toBe('cancelled');
    expect(snapshot.version).toBe('2.0.0');
    expect(snapshot.releaseNotes).toEqual(['note']);
    expect(snapshot.progress).toBeNull();
  });

  it('cancel() 期间 downloadUpdate 的 reject 不得把 cancelled 覆盖成 error', async () => {
    // 复刻 electron-updater：token 取消后 downloadUpdate 才 reject，
    // 此时 cancel() 已把实例字段置空，catch 若读字段就会误判为下载失败
    const mockUpdater = createMockUpdater({
      downloadUpdate: (token) =>
        new Promise((_resolve, reject) => {
          const tick = () => {
            if ((token as { cancelled?: boolean } | undefined)?.cancelled) {
              reject(new Error('Cancelled'));
              return;
            }
            setTimeout(tick, 5);
          };
          tick();
        }),
    });

    const service = createService(mockUpdater);
    service.mockEmit({ type: 'available', version: '2.0.0' });

    const pending = service.download();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await service.cancel();
    await pending;

    const snapshot = service.getSnapshot();
    expect(snapshot.state).toBe('cancelled');
    expect(snapshot.version).toBe('2.0.0');
    expect(snapshot.error).toBeNull();
  });

  it('allows re-download from cancelled state', async () => {
    const service = createService(createMockUpdater());
    service.mockEmit({ type: 'available', version: '2.0.0' });
    service.mockEmit({ type: 'progress', percent: 30 });
    service.mockEmit({ type: 'cancelled' });

    const snapshot = await service.download();

    expect(snapshot.state).toBe('downloading');
  });
});
