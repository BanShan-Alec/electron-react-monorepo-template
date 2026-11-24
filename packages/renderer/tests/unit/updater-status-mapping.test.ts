import type { UpdaterSnapshot } from '@shared/types/updater';
import { describe, expect, it, vi } from 'vitest';
import {
  getStatusDescription,
  getStatusHeader,
  getUpdaterActions,
  shouldAutoCheckOnOpen,
  showsChangelog,
  showsProgress,
} from '@/features/updater/status-mapping';

// t 宏是 Vite 插件（@lingui/vite-plugin）的编译期转换，Vitest 管线不执行；
// 此处按模板字面量原语义 mock 为直拼，断言中文 msgid 路由
vi.mock('@lingui/core/macro', () => {
  const t = (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce(
      (acc, chunk, index) => acc + chunk + (index < values.length ? String(values[index]) : ''),
      '',
    );
  return { t };
});

function snapshot(overrides: Partial<UpdaterSnapshot>): UpdaterSnapshot {
  return { state: 'idle', progress: null, error: null, code: null, ...overrides };
}

function handlers() {
  return {
    check: vi.fn(),
    download: vi.fn(),
    cancel: vi.fn(),
    install: vi.fn(),
    retry: vi.fn(),
  };
}

describe('getStatusHeader', () => {
  it('maps every state to its title and subtitle', () => {
    expect(getStatusHeader(snapshot({ state: 'idle', currentVersion: '1.14.0' }))).toEqual({
      title: '让 Electron React Template 保持最新',
      subtitle: '当前安装的是版本 v1.14.0。立即检查，或让应用在启动时自动检查。',
    });
    expect(getStatusHeader(snapshot({ state: 'checking' }))).toEqual({
      title: '正在检查更新…',
      subtitle: '正在连接更新服务器…',
    });
    expect(getStatusHeader(snapshot({ state: 'up-to-date', currentVersion: '1.14.0' }))).toEqual({
      title: '已是最新版本',
      subtitle: '版本 v1.14.0 是当前可用的最新版本。',
    });
    expect(getStatusHeader(snapshot({ state: 'available', version: '2.0.0' }))).toEqual({
      title: '发现新版本 v2.0.0',
      subtitle: '现在下载，并在准备好时自行选择重启安装。',
    });
    expect(getStatusHeader(snapshot({ state: 'downloading', version: '2.0.0' }))).toEqual({
      title: '正在下载 v2.0.0',
      subtitle: '你可以关闭此窗口，下载会在后台继续。',
    });
    expect(getStatusHeader(snapshot({ state: 'downloaded', version: '2.0.0' }))).toEqual({
      title: '更新已可安装',
      subtitle: 'v2.0.0 已准备好安装。',
    });
    expect(getStatusHeader(snapshot({ state: 'cancelled', version: '2.0.0' }))).toEqual({
      title: '下载已取消',
      subtitle: '准备好后可以重新开始下载。',
    });
    expect(getStatusHeader(snapshot({ state: 'error' }))).toEqual({
      title: '无法更新',
      subtitle: '请稍后重试。',
    });
  });

  it('falls back to version-agnostic copy when metadata is missing', () => {
    expect(getStatusHeader(snapshot({ state: 'available' })).title).toBe('发现新版本');
    expect(getStatusHeader(snapshot({ state: 'downloading' })).title).toBe('正在下载更新');
    expect(getStatusHeader(snapshot({ state: 'downloaded' })).subtitle).toBe(
      '新版本已准备好安装，重启后完成升级。',
    );
    expect(getStatusHeader(snapshot({ state: 'up-to-date' })).subtitle).toBe(
      '当前安装的应用已包含全部最新功能。',
    );
    expect(getStatusHeader(snapshot({ state: 'idle' })).subtitle).toBe(
      '立即检查，或让应用在启动时自动检查。',
    );
  });
});

describe('getStatusDescription', () => {
  it('returns the semantic copy per error code', () => {
    expect(getStatusDescription(snapshot({ state: 'error', code: 'UPDATER_NETWORK_ERROR' }))).toBe(
      '网络连接失败或超时，请检查网络后重试。',
    );
    expect(getStatusDescription(snapshot({ state: 'error', code: 'UPDATER_NOT_CONFIGURED' }))).toBe(
      '更新服务未配置。',
    );
    expect(getStatusDescription(snapshot({ state: 'error', code: null }))).toBe(
      '更新过程中出现未知错误，请稍后重试。',
    );
  });

  it('returns empty string for non-error states', () => {
    expect(getStatusDescription(snapshot({ state: 'idle' }))).toBe('');
    expect(getStatusDescription(snapshot({ state: 'downloading', version: '2.0.0' }))).toBe('');
  });
});

describe('getUpdaterActions', () => {
  it('routes idle / up-to-date to a default check action', () => {
    const h = handlers();
    const actions = getUpdaterActions(snapshot({ state: 'idle' }), h);
    actions.primary?.onClick?.();
    expect(h.check).toHaveBeenCalledTimes(1);
    expect(actions.primary?.variant).toBe('default');
    expect(actions.secondary).toBeUndefined();
  });

  it('shows a loading and disabled button while checking', () => {
    const actions = getUpdaterActions(snapshot({ state: 'checking' }), handlers());
    expect(actions.primary?.loading).toBe(true);
    expect(actions.primary?.disabled).toBe(true);
    expect(actions.primary?.onClick).toBeUndefined();
  });

  it('routes available to a primary download action', () => {
    const h = handlers();
    const actions = getUpdaterActions(snapshot({ state: 'available', version: '2.0.0' }), h);
    actions.primary?.onClick?.();
    expect(h.download).toHaveBeenCalledTimes(1);
    expect(actions.primary?.variant).toBe('primary');
    expect(actions.primary?.label).toBe('下载更新');
  });

  it('renders a clamped percent button with an accessible label and a cancel secondary', () => {
    const h = handlers();
    const actions = getUpdaterActions(
      snapshot({ state: 'downloading', version: '2.0.0', progress: { percent: 47.6 } }),
      h,
    );
    expect(actions.primary?.label).toBe('48%');
    expect(actions.primary?.ariaLabel).toBe('正在下载更新 48%');
    expect(actions.primary?.disabled).toBe(true);
    expect(actions.primary?.mono).toBe(true);
    expect(actions.primary?.onClick).toBeUndefined();

    actions.secondary?.onClick?.();
    expect(h.cancel).toHaveBeenCalledTimes(1);
  });

  it('routes downloaded to install and cancelled back to download', () => {
    const h = handlers();
    getUpdaterActions(snapshot({ state: 'downloaded', version: '2.0.0' }), h).primary?.onClick?.();
    expect(h.install).toHaveBeenCalledTimes(1);

    const cancelled = getUpdaterActions(snapshot({ state: 'cancelled', version: '2.0.0' }), h);
    expect(cancelled.primary?.label).toBe('重试');
    cancelled.primary?.onClick?.();
    expect(h.download).toHaveBeenCalledTimes(1);
  });

  it('cancelled 无版本元数据时回退为检查而非下载（与 handleRetry 同源）', () => {
    const h = handlers();
    getUpdaterActions(snapshot({ state: 'cancelled' }), h).primary?.onClick?.();
    expect(h.check).toHaveBeenCalledTimes(1);
    expect(h.download).not.toHaveBeenCalled();
  });

  it('每个动作都带语义图标键（Motrix 同款：下载 / 重试 / 重启）', () => {
    expect(getUpdaterActions(snapshot({ state: 'idle' }), handlers()).primary?.icon).toBe(
      'refresh',
    );
    expect(
      getUpdaterActions(snapshot({ state: 'available', version: '2.0.0' }), handlers()).primary
        ?.icon,
    ).toBe('download');
    expect(
      getUpdaterActions(snapshot({ state: 'downloaded', version: '2.0.0' }), handlers()).primary
        ?.icon,
    ).toBe('restart');
    expect(getUpdaterActions(snapshot({ state: 'error' }), handlers()).primary?.icon).toBe(
      'refresh',
    );
  });

  it('routes error to retry', () => {
    const h = handlers();
    const actions = getUpdaterActions(snapshot({ state: 'error' }), h);
    actions.primary?.onClick?.();
    expect(h.retry).toHaveBeenCalledTimes(1);
    expect(actions.primary?.variant).toBe('primary');
  });

  it('keeps at most one primary-styled action per state', () => {
    const h = handlers();
    const states = [
      'idle',
      'checking',
      'available',
      'downloading',
      'downloaded',
      'cancelled',
      'up-to-date',
      'error',
    ] as const;
    for (const state of states) {
      const actions = getUpdaterActions(snapshot({ state }), h);
      const primaries = [actions.primary, actions.secondary].filter(
        (action) => action?.variant === 'primary',
      );
      expect(primaries.length).toBeLessThanOrEqual(1);
    }
  });
});

describe('showsChangelog', () => {
  it('无版本元数据时一律不渲染（含 cancelled/error）', () => {
    for (const state of ['cancelled', 'error', 'available'] as const) {
      expect(showsChangelog(snapshot({ state }))).toBe(false);
    }
  });

  it('有版本元数据时仅 available/downloading/downloaded/cancelled/error 渲染', () => {
    const visible = ['available', 'downloading', 'downloaded', 'cancelled', 'error'] as const;
    for (const state of visible) {
      expect(showsChangelog(snapshot({ state, version: '1.2.3' }))).toBe(true);
    }
    for (const state of ['idle', 'checking', 'up-to-date'] as const) {
      expect(showsChangelog(snapshot({ state, version: '1.2.3' }))).toBe(false);
    }
  });
});

describe('showsProgress', () => {
  it('仅 downloading 态渲染进度卡片', () => {
    expect(showsProgress(snapshot({ state: 'downloading' }))).toBe(true);
    expect(showsProgress(snapshot({ state: 'downloaded' }))).toBe(false);
    expect(showsProgress(snapshot({ state: 'cancelled' }))).toBe(false);
  });
});

describe('shouldAutoCheckOnOpen', () => {
  it('仅 idle / up-to-date 允许开窗即查', () => {
    expect(shouldAutoCheckOnOpen('idle')).toBe(true);
    expect(shouldAutoCheckOnOpen('up-to-date')).toBe(true);
  });

  it('已带结果或正在推进的阶段不得重查（否则会把 available 覆盖成 checking）', () => {
    const blocked = ['checking', 'downloading', 'available', 'downloaded', 'cancelled', 'error'];
    for (const state of blocked as const) {
      expect(shouldAutoCheckOnOpen(state)).toBe(false);
    }
  });
});
